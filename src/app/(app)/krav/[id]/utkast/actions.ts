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

/**
 * Sikkerhetsnett mot markdown i et brev som limes inn som ren tekst. Fjerner
 * stjerne-punktlister i linjestart og alle gjenværende stjerner (fet/kursiv).
 * Brev på norsk inneholder praktisk talt aldri legitime stjerner.
 */
function fjernStjerner(tekst: string): string {
  return tekst
    .replace(/^[ \t]*\*[ \t]+/gm, "")
    .replace(/\*/g, "")
    .trim();
}

export type UtkastResultat =
  | { ok: true; id: string; innhold: string }
  | { ok: false; feil?: string; paywall?: boolean };

const FORMÅL: Record<UtkastType, string> = {
  innsigelse:
    "en innsigelse der personen bestrider kravet helt eller delvis",
  betalingsutsettelse:
    "en høflig forespørsel om betalingsutsettelse til en konkret dato, uten å bestride kravet",
  nedbetalingsavtale:
    "et forslag om nedbetalingsavtale med konkret månedsbeløp og varighet, uten å bestride kravet",
  klage: "en klage på vedtaket/kravet",
};

// Tonereglene som definerer Medholds brevstemme (arbeidsordre
// MEDHOLD_REFERANSEBREV.md). Delt mellom alle utkasttyper.
const TONEREGLER = `Toneregler for brevet:
1. Kort: ingen setning over cirka 20 ord, ingen avsnitt over tre setninger, hele brevet under 200 ord.
2. «Jeg» er subjektet, aktiv form — «Jeg er uenig i kravet», aldri «Det gjøres innsigelse mot kravet».
3. Konklusjonen først: uenig/enig/forslag kommer i avsnitt to, før begrunnelsen.
4. Fakta med datoer, ikke karakteristikker — «Jeg sa opp 28. november og har bekreftelsen», aldri «kravet er urimelig og uholdbart».
5. Be om konkrete handlinger, ikke vurderinger — registrer som omtvistet, stans inndrivingen, bekreft skriftlig, korriger, avslutt saken, send til forliksrådet.
6. Bruk ALDRI disse ordene: anmodning, anmoder, vedrørende, herved, undertegnede, imøteser, bero, fremsettes, «viser til ovennevnte», «på bakgrunn av dette», besørge, angjeldende, erlegge, «Deres» med stor D.
7. Det personen selv skrev i detaljfeltet skal kunne kjennes igjen i brevet — ryddet for skrivefeil, ikke oversatt til jusspråk.
8. Høflig uten å krype: ingen «beklager at jeg må», ingen «håper på forståelse», ingen utropstegn. «Vennlig hilsen», ferdig.
9. Ren tekst, ingen markdown. En kort strekliste (med "-") er greit når det er tre eller flere konkrete handlingspunkter.`;

type FewShot = { bruker: string; svar: string };

// Eksemplene under er hentet fra referansebrevene i arbeidsordren. Navn,
// beløp og datoer i eksemplene er kun illustrasjon for tonen — modellen
// instrueres eksplisitt om å bruke sakens egne verdier, aldri disse.
const EKSEMPEL_BESTRID_HELT: FewShot = {
  bruker: `Brevet det svares på:

Betalingsoppfordring fra Pulsløft Treningssenter AS. Saksnummer FK-2026-88213. Datert 12. juli 2026. Krever 3 243,20 kr for medlemskap januar–mars 2026.

Det personen selv oppgir: sa opp i november, har eposten som bevis`,
  svar: `Jeg har mottatt betalingsoppfordringen deres datert 12. juli 2026, med krav på 3 243,20 kr på vegne av Pulsløft Treningssenter AS.

Jeg er uenig i kravet og betaler det ikke.

Kravet gjelder medlemskap for januar til mars 2026. Jeg sa opp medlemskapet skriftlig 28. november 2025 og har e-postbekreftelse på at oppsigelsen ble mottatt. Med én måneds oppsigelsestid var medlemskapet avsluttet 31. desember 2025. Det er derfor ikke grunnlag for å fakturere meg for januar, februar og mars.

Kravet er dermed omtvistet og kan ikke drives inn ved ordinær inkasso. Jeg ber om at dere:
- registrerer kravet som omtvistet og stanser videre inndriving
- bekrefter dette skriftlig
- enten avslutter saken eller sender den til forliksrådet, hvis dere mener kravet står seg

Dokumentasjonen sender jeg gjerne ved behov.

Vennlig hilsen`,
};

const EKSEMPEL_BESTRID_DELVIS: FewShot = {
  bruker: `Brevet det svares på:

Betalingsoppfordring. Saksnummer KY-2026-3341. Datert 13. juli 2026. Hovedkrav 2 400 kr. Inkassosalær 800 kr.

Fakta fra Medhold: Inkassosalæret på 800 kr overstiger lovlig maksimalsats. Høyeste tillatte salær for et krav i denne størrelsen er 750 kr.

Personen har ikke oppgitt utfyllende detaljer.`,
  svar: `Jeg viser til betalingsoppfordringen deres datert 13. juli 2026.

Hovedkravet på 2 400 kr er jeg enig i, og det betaler jeg innen fristen.

Inkassosalæret på 800 kr er jeg uenig i. Høyeste tillatte salær etter inkassoforskriften er 750 kr for et krav på denne størrelsen. Salæret er altså 50 kr over lovlig maksimalsats, og denne delen av kravet er omtvistet til den er korrigert.

Jeg ber om at dere retter salæret og sender meg en oppdatert oppstilling.

Vennlig hilsen`,
};

const EKSEMPEL_NEDBETALING: FewShot = {
  bruker: `Brevet det svares på:

Betalingsoppfordring. Saksnummer FK-2026-88213. Datert 12. juli 2026. Krav 3 243,20 kr.

Fakta fra Medhold: Nedbetalingsforslag: 500 kr per måned i 7 måneder (siste avdrag 243,20 kr).

Personen har ikke oppgitt utfyllende detaljer.`,
  svar: `Jeg viser til betalingsoppfordringen deres datert 12. juli 2026. Kravet på 3 243,20 kr er riktig, og jeg vil gjøre opp for meg.

Jeg klarer ikke å betale alt på én gang. Jeg foreslår derfor 500 kr i måneden i sju måneder, med første betaling 1. august 2026 og et siste avdrag på 243,20 kr.

Kan dere bekrefte skriftlig om dere godtar forslaget? Jeg ber også om at saken ikke sendes videre mens dere vurderer det.

Vennlig hilsen`,
};

const EKSEMPEL_UTSETTELSE: FewShot = {
  bruker: `Brevet det svares på:

Inkassovarsel. Saksnummer AG-2026-04471. Datert 10. juli 2026. Betalingsfrist 24. juli 2026.

Det personen selv oppgir: får lønn 15.`,
  svar: `Jeg viser til inkassovarselet datert 10. juli 2026 med betalingsfrist 24. juli. Kravet er riktig, og jeg skal betale hele beløpet.

Jeg rekker ikke fristen, men kan betale alt 15. august, rett etter lønning. Jeg ber derfor om utsatt frist til denne datoen.

Kan dere bekrefte skriftlig at det er i orden?

Vennlig hilsen`,
};

// Klage ligner mest på en full bestridelse (uenig, konkret handling bedt om).
const EKSEMPLER: Record<UtkastType, FewShot[]> = {
  innsigelse: [EKSEMPEL_BESTRID_HELT, EKSEMPEL_BESTRID_DELVIS],
  betalingsutsettelse: [EKSEMPEL_UTSETTELSE],
  nedbetalingsavtale: [EKSEMPEL_NEDBETALING],
  klage: [EKSEMPEL_BESTRID_HELT],
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
- Dette er et FORSLAG om nedbetalingsavtale, ikke en bestridelse av kravet. Bruk avdragsforslaget fra «Fakta fra Medhold» ORDRETT (nøyaktig månedsbeløp, antall måneder og siste avdrag). Be om skriftlig bekreftelse på avtalen, og be høflig om at videre inndriving og nye omkostninger settes på vent mens forslaget vurderes. Hold en verdig, saklig tone — ingen bønnfallelse, og ikke oppgi grunner personen ikke selv har skrevet.`
      : "";

  const system = `Du skriver et utkast til ${FORMÅL[type]} på vegne av en privatperson som har fått et brev om gjeld/inkasso.

${TONEREGLER}

Ufravikelige regler:
- Skriv KUN ren tekst, klar til å limes rett inn i en e-post. INGEN markdown: ingen stjerner (*), ingen fet skrift, ingen overskrifter (#). Bruk vanlig bindestrek (-) for korte handlingslister, aldri stjerner.
- Bruk KUN fakta fra brevet, det personen selv oppgir, og fakta fra Medhold når det er oppgitt. Finn ALDRI opp beløp, datoer, paragrafer, navn eller omstendigheter.
- Nevn ikke forhold personen ikke har oppgitt. Er noe uklart, hold det generelt fremfor å gjette.
- Ikke gi garantier om utfallet. Ikke lat som du er advokat.${gebyrRegel}${avtaleRegel}
- Skriv kun selve brevteksten (ingen forklaring rundt, ingen «her er utkastet»), og avslutt med «Vennlig hilsen» uten navn under.
- Eksemplene i samtalen viser ønsket tone, lengde og struktur. Navn, beløp, datoer og saksnumre i eksemplene er kun illustrasjon — bruk alltid sakens faktiske verdier, aldri eksemplenes.`;

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

  const fewShotMeldinger = EKSEMPLER[type].flatMap((ex) => [
    { role: "user" as const, content: ex.bruker },
    { role: "assistant" as const, content: ex.svar },
  ]);

  let innhold: string;
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: AI_MODELL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system,
      messages: [...fewShotMeldinger, { role: "user", content: bruker }],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    if (!blokk || blokk.type !== "text")
      return { ok: false, feil: "Fikk ikke et brukbart utkast. Prøv igjen." };
    innhold = fjernStjerner(blokk.text);
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
