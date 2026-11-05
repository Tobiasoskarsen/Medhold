// Intern servermodul. Må IKKE ligge i en "use server"-fil: alt som eksporteres
// derfra kan bli et offentlig endepunkt så snart klientkode importerer det.
import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { UtkastType } from "@/lib/types";
import type { GebyrsjekkResultat, Kostnadslinje } from "@/lib/gebyr";
import type { AvdragsForslag } from "@/lib/avdrag";
import { idagOslo } from "@/lib/dato";
import {
  byggPrompt,
  gjeldendeOmfang,
  ubestridtDel,
  type Omfang,
  type UtkastMelding,
} from "@/lib/utkast-prompt";
import { byggVaktFakta, type VaktFakta } from "@/lib/utkast-vakt";

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
