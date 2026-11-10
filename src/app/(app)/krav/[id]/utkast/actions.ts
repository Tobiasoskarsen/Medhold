"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { harPluss } from "@/lib/plan";
import { type UtkastType } from "@/lib/types";
import type { AvdragsForslag } from "@/lib/avdrag";
import { genererUtkast, type Omfang } from "@/lib/utkast-prompt";
import { AI_MODELL } from "@/lib/ai";
import { forsokId } from "@/lib/kvote";
import { startKvote } from "@/lib/kvote-server";
import { logg, feilInfo } from "@/lib/logg";
import { maskerFodselsnummer } from "@/lib/maskering";
import type { VaktFunn } from "@/lib/utkast-vakt";
import { byggUtkastPrompt } from "./byggUtkastPrompt";

export type UtkastResultat =
  | { ok: true; id: string; innhold: string; advarsler: VaktFunn[] }
  | { ok: false; feil?: string; paywall?: boolean };

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

  // Samme kvote som strømmeruten.
  const kvote = await startKvote(
    "utkast",
    user.id,
    forsokId("utkast", user.id, sakId, brevId, type, detaljer, navn, JSON.stringify(avdrag ?? null), omfang ?? null),
  );
  if (!kvote.ok) return { ok: false, feil: kvote.melding };

  // Etterkontroll: «AI tolker, kode beslutter» — også for stil og fakta.
  // Forbudte ord, lengde og vaktfunn → ÉN regenerering (ikke en løkke, av
  // kostnadshensyn). Det som fortsatt står igjen, logges og vises som
  // advarsel — utkastet blokkeres aldri (guardrail 5).
  let innhold: string;
  let advarsler: VaktFunn[];
  try {
    const r = await genererUtkast(new Anthropic(), prompt, prompt.vaktFakta);
    // Modellen svarte (også om svaret var ubrukelig): forsøket er brukt.
    await kvote.vakt.avslutt(true, { modell: AI_MODELL, ai_kall: r?.regenerert ? 2 : 1 });
    if (r === null)
      return { ok: false, feil: "Fikk ikke et brukbart utkast. Prøv igjen." };
    innhold = r.tekst;
    advarsler = r.advarsler;
    if (r.regenerert && advarsler.length > 0) {
      logg("warn", "lagUtkast", "vaktfunn_etter_regenerering", { utkasttype: type, antall: advarsler.length });
    }
  } catch (e) {
    // API-feil (nettverk, tidsavbrudd): belaster ikke brukeren.
    await kvote.vakt.avslutt(false, { modell: AI_MODELL, feil: "ukjent" });
    logg("error", "lagUtkast", "generering_feilet", feilInfo(e));
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
      innhold: maskerFodselsnummer(innhold),
      vakt_fakta: prompt.vaktFakta,
    })
    .select("id")
    .single();
  if (lagreFeil || !lagret) {
    logg("error", "lagUtkast", "innsetting_feilet", { utkasttype: type, kode: lagreFeil?.code ?? "ukjent" });
    return { ok: false, feil: "Kunne ikke lagre utkastet. Prøv igjen." };
  }

  revalidatePath(`/krav/${sakId}`);
  return { ok: true, id: lagret.id, innhold: maskerFodselsnummer(innhold), advarsler };
}

/**
 * Brukeren bekrefter selv at utkastet er sendt (via egen e-postklient eller
 * utenfor appen — appen sender ALDRI noe til kreditor). Setter sendt_at og
 * flytter saken til 'venter_pa_svar' hvis den er aktiv. Kode beslutter.
 */
export async function markerUtkastSendt(
  utkastId: string,
  forventetVersjon?: number,
): Promise<{ ok: true; sakId: string } | { ok: false; feil: string; ukjent?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // RLS sikrer at man kun når sitt eget utkast.
  const { data: utkast } = await supabase
    .from("utkast")
    .select("id, sak_id, sendt_at, versjon")
    .eq("id", utkastId)
    .maybeSingle();
  if (!utkast) return { ok: false, feil: "Fant ikke utkastet." };

  const { error } = await supabase.rpc("registrer_utkast_sendt", {
    p_id: utkastId, p_versjon: forventetVersjon ?? utkast.versjon,
  });
  if (error) return { ok: false, ukjent: true, feil: "Kunne ikke bekrefte sendtregistreringen. Kontroller serverstatus før du prøver igjen." };

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${utkast.sak_id}`);
  return { ok: true, sakId: utkast.sak_id };
}

/** Ingen AI-kall. Versjonsbetinget UPDATE stopper stille overskriving fra to faner. */
export async function lagreRedigertUtkast(id: string, sakId: string, versjon: number, tekst: string): Promise<
  { ok: true; tekst: string; versjon: number } | { ok: false; feil: string; ukjent?: boolean }
> {
  if (typeof tekst !== "string" || !tekst.trim() || tekst.length > 50000 || !Number.isInteger(versjon))
    return { ok: false, feil: "Utkastet må inneholde tekst og være under 50 000 tegn." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Logg inn igjen før du lagrer." };
  const tryggTekst = maskerFodselsnummer(tekst);
  const { data, error } = await supabase.from("utkast").update({ innhold: tryggTekst })
    .eq("id", id).eq("sak_id", sakId).eq("bruker_id", user.id)
    .eq("versjon", versjon).is("sendt_at", null).select("innhold, versjon").maybeSingle();
  if (error) return { ok: false, ukjent: true, feil: "Kunne ikke bekrefte lagringen. Teksten er beholdt i fanen; neste forsøk kontrollerer serverversjonen først." };
  if (!data) return { ok: false, feil: "Ikke lagret. Utkastet er endret eller sendt i en annen fane. Ta vare på teksten og åpne det på nytt." };
  return { ok: true, tekst: data.innhold, versjon: data.versjon };
}

/** Kun lesing. Avklar et tapt lagrings-/sendtsvar før et nytt skriveforsøk. */
export async function hentUtkastStatus(id: string, sakId: string): Promise<
  { ok: true; tekst: string; versjon: number; sendt: boolean } | { ok: false; feil: string }
> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof id !== "string" || typeof sakId !== "string" || !uuid.test(id) || !uuid.test(sakId))
    return { ok: false, feil: "Fant ikke utkastet i saken." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Logg inn igjen for å kontrollere status." };
  const { data, error } = await supabase.from("utkast")
    .select("innhold, versjon, sendt_at, sendt_innhold")
    .eq("id", id).eq("sak_id", sakId).eq("bruker_id", user.id).maybeSingle();
  if (error || !data) return { ok: false, feil: "Kunne ikke hente utkaststatus. Ingen ny registrering er utført." };
  return { ok: true, tekst: data.sendt_innhold ?? data.innhold, versjon: data.versjon, sendt: !!data.sendt_at };
}
