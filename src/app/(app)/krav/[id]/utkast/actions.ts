"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { harPluss } from "@/lib/plan";
import { type UtkastType } from "@/lib/types";
import type { GebyrsjekkResultat, Kostnadslinje } from "@/lib/gebyr";
import type { AvdragsForslag } from "@/lib/avdrag";
import { idagOslo } from "@/lib/dato";
import {
  byggPrompt,
  genererUtkast,
  gjeldendeOmfang,
  ubestridtDel,
  type Omfang,
  type UtkastMelding,
} from "@/lib/utkast-prompt";
import { byggVaktFakta, type VaktFakta, type VaktFunn } from "@/lib/utkast-vakt";

export type UtkastResultat =
  | { ok: true; id: string; innhold: string; advarsler: VaktFunn[] }
  | { ok: false; feil?: string; paywall?: boolean };

/**
 * Henter sakens fakta (brev, gebyrsjekk, stadium, frist) og bygger prompten
 * og vaktfaktaene for et utkast. Selve prompten bygges av den rene
 * `byggPrompt` (lib/utkast-prompt.ts), så fasit-skriptet bruker nøyaktig
 * samme tekst. Brukes av BÅDE `lagUtkast` og streaming-ruten
 * (`api/utkast-generer/route.ts`). `supabase` er en allerede autentisert
 * klient (RLS sikrer eierskap på brev/sak-oppslagene); kalleren gjør sin egen
 * auth-/paywall-/nøkkel-sjekk FØR denne kalles.
 */
export async function byggUtkastPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sakId: string,
  brevId: string | null,
  type: UtkastType,
  detaljer: string,
  navn: string,
  avdrag?: AvdragsForslag | null,
  omfangValgt?: Omfang | null,
): Promise<
  | { system: string; meldinger: UtkastMelding[]; vaktFakta: VaktFakta }
  | { feil: string }
> {
  // Hent brevet det svares på (RLS sikrer eierskap).
  let brev: {
    original_tekst: string | null;
    gebyrsjekk: unknown;
    brevdato: string | null;
    belop: number | null;
    belop_hovedstol: number | null;
    kostnadslinjer: unknown;
  } | null = null;
  let fristdato: string | null = null;
  if (brevId) {
    const [{ data: b }, { data: frister }] = await Promise.all([
      supabase
        .from("brev")
        .select(
          "original_tekst, gebyrsjekk, brevdato, belop, belop_hovedstol, kostnadslinjer",
        )
        .eq("id", brevId)
        .maybeSingle(),
      supabase
        .from("frister")
        .select("forfallsdato")
        .eq("brev_id", brevId)
        .order("forfallsdato", { ascending: true })
        .limit(1),
    ]);
    brev = b;
    fristdato = (frister?.[0]?.forfallsdato as string | undefined) ?? null;
  }
  const gs = (brev?.gebyrsjekk as GebyrsjekkResultat | null) ?? null;

  // Eksplisitt eierskapssjekk (utover RLS): finnes ikke saken, avbryt her —
  // samme feil-union brukes av streaming-ruten (§B.2) til å svare 404/feil
  // FØR noe AI-kall gjøres.
  const { data: sak } = await supabase
    .from("saker")
    .select("stadium, belop_totalt")
    .eq("id", sakId)
    .maybeSingle();
  if (!sak) return { feil: "Fant ikke saken." };

  // Kode beslutter omfanget: «delvis» krever et gebyrfunn (§D.1).
  const omfang = gjeldendeOmfang(type, gs, omfangValgt);
  const belopTotalt =
    (sak.belop_totalt as number | null) ?? brev?.belop ?? null;
  const avdragForType = type === "nedbetalingsavtale" ? (avdrag ?? null) : null;

  const { system, meldinger } = byggPrompt({
    type,
    originalTekst: brev?.original_tekst ?? "",
    gebyrsjekk: gs,
    stadium: (sak.stadium as string | null) ?? null,
    belopTotalt,
    detaljer,
    navn,
    avdrag: avdragForType,
    omfang,
  });

  const vaktFakta = byggVaktFakta({
    originalTekst: brev?.original_tekst ?? null,
    belopTotalt,
    belopHovedstol: brev?.belop_hovedstol ?? null,
    kostnadslinjer: (brev?.kostnadslinjer as Kostnadslinje[] | null) ?? [],
    gebyrsjekk: gs,
    ubestridt: omfang === "delvis" ? ubestridtDel(belopTotalt, gs) : null,
    avdrag: avdragForType,
    detaljer,
    brevdato: brev?.brevdato ?? null,
    fristdato,
    idag: idagOslo(),
    omfang,
  });

  return { system, meldinger, vaktFakta };
}

export async function lagUtkast(
  sakId: string,
  brevId: string | null,
  type: UtkastType,
  detaljer: string,
  navn: string,
  avdrag?: AvdragsForslag | null,
  omfang?: Omfang | null,
): Promise<UtkastResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // Gating: utkastgenerering krever Pluss (i pilotmodus alltid tillatt).
  if (!(await harPluss(user.id))) return { ok: false, paywall: true };

  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, feil: "AI er ikke konfigurert (mangler API-nøkkel)." };

  const prompt = await byggUtkastPrompt(
    supabase,
    sakId,
    brevId,
    type,
    detaljer,
    navn,
    avdrag,
    omfang,
  );
  if ("feil" in prompt) return { ok: false, feil: prompt.feil };

  // Etterkontroll: «AI tolker, kode beslutter» — også for stil og fakta.
  // Forbudte ord, lengde og vaktfunn → ÉN regenerering (ikke en løkke, av
  // kostnadshensyn). Det som fortsatt står igjen, logges og vises som
  // advarsel — utkastet blokkeres aldri (guardrail 5).
  let innhold: string;
  let advarsler: VaktFunn[];
  try {
    const r = await genererUtkast(new Anthropic(), prompt, prompt.vaktFakta);
    if (r === null)
      return { ok: false, feil: "Fikk ikke et brukbart utkast. Prøv igjen." };
    innhold = r.tekst;
    advarsler = r.advarsler;
    if (r.regenerert && advarsler.length > 0) {
      console.error(
        `[lagUtkast] Vaktfunn står igjen etter regenerering (type=${type}):`,
        advarsler.map((a) => a.rettelinje),
      );
    }
  } catch (e) {
    console.error("[lagUtkast] AI-generering feilet:", e);
    return { ok: false, feil: "Noe gikk galt. Prøv igjen om litt." };
  }

  // Husk navnet til neste gang (§6). Best-effort — skal aldri velte
  // utkastgenereringen selv om denne skulle feile.
  const navnTrimmet = navn.trim();
  if (navnTrimmet) {
    await supabase.auth
      .updateUser({ data: { brevnavn: navnTrimmet } })
      .catch(() => {});
  }

  // Lagre som tidslinjehendelse på kravet.
  const { data: lagret, error: lagreFeil } = await supabase
    .from("utkast")
    .insert({
      sak_id: sakId,
      bruker_id: user.id,
      brev_id: brevId,
      type,
      innhold,
    })
    .select("id")
    .single();
  if (lagreFeil || !lagret) {
    console.error(
      `[lagUtkast] Innsetting feilet (type=${type}, brev_id=${brevId}):`,
      lagreFeil,
    );
    return { ok: false, feil: "Kunne ikke lagre utkastet. Prøv igjen." };
  }

  revalidatePath(`/krav/${sakId}`);
  return { ok: true, id: lagret.id, innhold, advarsler };
}

/**
 * Brukeren bekrefter selv at utkastet er sendt (via egen e-postklient eller
 * utenfor appen — appen sender ALDRI noe til kreditor). Setter sendt_at og
 * flytter saken til 'venter_pa_svar' hvis den er aktiv. Kode beslutter.
 */
export async function markerUtkastSendt(
  utkastId: string,
): Promise<{ ok: true; sakId: string } | { ok: false; feil: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // RLS sikrer at man kun når sitt eget utkast.
  const { data: utkast } = await supabase
    .from("utkast")
    .select("id, sak_id, sendt_at")
    .eq("id", utkastId)
    .maybeSingle();
  if (!utkast) return { ok: false, feil: "Fant ikke utkastet." };

  if (!utkast.sendt_at) {
    const { error } = await supabase
      .from("utkast")
      .update({ sendt_at: new Date().toISOString() })
      .eq("id", utkastId);
    if (error) return { ok: false, feil: "Kunne ikke lagre. Prøv igjen." };
  }

  // Kun aktiv → venter_pa_svar; fullførte/ventende saker røres ikke.
  await supabase
    .from("saker")
    .update({ status: "venter_pa_svar" })
    .eq("id", utkast.sak_id)
    .eq("status", "aktiv");

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${utkast.sak_id}`);
  return { ok: true, sakId: utkast.sak_id };
}
