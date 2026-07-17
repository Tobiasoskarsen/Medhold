"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { harPluss } from "@/lib/plan";
import { type UtkastType } from "@/lib/types";
import { gebyrFunnTekst, type GebyrsjekkResultat } from "@/lib/gebyr";
import type { AvdragsForslag } from "@/lib/avdrag";
import { AI_MODELL } from "@/lib/ai";

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

export type UtkastResultat =
  | { ok: true; id: string; innhold: string }
  | { ok: false; feil?: string; paywall?: boolean };

const FORMÅL: Record<UtkastType, string> = {
  innsigelse:
    "en innsigelse der personen bestrider kravet helt eller delvis",
  betalingsutsettelse:
    "en høflig anmodning om betalingsutsettelse til en konkret dato, uten å bestride kravet",
  nedbetalingsavtale:
    "et forslag om nedbetalingsavtale med konkret månedsbeløp og varighet, uten å bestride kravet",
  klage: "en klage på vedtaket/kravet",
};

export async function lagUtkast(
  sakId: string,
  brevId: string | null,
  type: UtkastType,
  detaljer: string,
  avdrag?: AvdragsForslag | null,
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

  // Hent brevet det svares på (RLS sikrer eierskap).
  let original = "";
  let gebyrFakta = "";
  if (brevId) {
    const { data: brev } = await supabase
      .from("brev")
      .select("original_tekst, gebyrsjekk")
      .eq("id", brevId)
      .maybeSingle();
    original = brev?.original_tekst ?? "";
    // Kun «over»-funn sendes til prompten (kode beslutter, ikke AI). mulig_over
    // og ukjent holdes utenfor — konservativt.
    const gs = (brev?.gebyrsjekk as GebyrsjekkResultat | null) ?? null;
    if (gs && gs.antallOver > 0) gebyrFakta = gebyrFunnTekst(gs);
  }

  const detalj = detaljer.trim();
  const gebyrRegel = gebyrFakta
    ? `
- Appen har gjort en automatisk kontroll mot inkassoforskriftens maksimalsatser (se «Fakta fra Medhold» under). Du KAN vise til at det aktuelle beløpet overstiger den lovlige maksimalsatsen etter inkassoforskriften, men oppgi ALDRI paragrafnummer, og hold tonen rolig og saklig — ikke skjerp den.`
    : "";

  // Avdragsforslag fra koden (Veier ut → avdragshjelperen). Kun for
  // nedbetalingsavtale, og kun tallene — ingen begrunnelse legges til.
  const avdragFakta =
    type === "nedbetalingsavtale" && avdrag && avdrag.antallMandeder > 0
      ? `Nedbetalingsforslag: ${kr(avdrag.manedsbelop)} kr per måned i ${avdrag.antallMandeder} måneder (siste avdrag ${kr(avdrag.sisteAvdrag)} kr).`
      : "";
  const avtaleRegel =
    type === "nedbetalingsavtale"
      ? `
- Dette er et FORSLAG om nedbetalingsavtale, ikke en bestridelse av kravet. Bruk avdragsforslaget fra «Fakta fra Medhold» ORDRETT (nøyaktig månedsbeløp, antall måneder og siste avdrag). Be om SKRIFTLIG bekreftelse på avtalen, og be om at videre inndriving stilles i bero mens forslaget vurderes. Hold en verdig, saklig tone — ingen bønnfallelse, og ikke oppgi grunner personen ikke selv har skrevet.`
      : "";

  const system = `Du skriver et utkast til ${FORMÅL[type]} på vegne av en privatperson som har fått et brev om gjeld/inkasso.

Ufravikelige regler:
- Skriv et ferdig, høflig og saklig brev på norsk (bokmål), klart til å sendes.
- Bruk KUN fakta fra brevet, det personen selv oppgir, og fakta fra Medhold når det er oppgitt. Finn ALDRI opp beløp, datoer, paragrafer eller omstendigheter.
- Nevn ikke forhold personen ikke har oppgitt. Er noe uklart, hold det generelt fremfor å gjette.
- Ikke gi garantier om utfallet. Ikke lat som du er advokat.${gebyrRegel}${avtaleRegel}
- Skriv kun selve brevteksten (ingen forklaring rundt, ingen «her er utkastet»).`;

  const bruker = [
    original ? `Brevet det svares på:\n\n${original}` : null,
    gebyrFakta ? `Fakta fra Medhold: ${gebyrFakta}` : null,
    avdragFakta ? `Fakta fra Medhold: ${avdragFakta}` : null,
    detalj
      ? `Det personen selv oppgir: ${detalj}`
      : "Personen har ikke oppgitt utfyllende detaljer.",
  ]
    .filter(Boolean)
    .join("\n\n");

  let innhold: string;
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: AI_MODELL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: bruker }],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    if (!blokk || blokk.type !== "text")
      return { ok: false, feil: "Fikk ikke et brukbart utkast. Prøv igjen." };
    innhold = blokk.text.trim();
  } catch (e) {
    console.error("[lagUtkast] AI-generering feilet:", e);
    return { ok: false, feil: "Noe gikk galt. Prøv igjen om litt." };
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
  return { ok: true, id: lagret.id, innhold };
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
