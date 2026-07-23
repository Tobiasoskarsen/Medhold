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
import {
  TONEREGLER,
  REFERANSEBREV,
  REFERANSEBREV_TILLEGG,
  MOTEKSEMPEL,
  finnForbudteOrd,
} from "@/lib/utkast-stemme";

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

function tellOrd(tekst: string): number {
  return tekst.split(/\s+/).filter(Boolean).length;
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

type FewShot = { bruker: string; svar: string };

// Synteiske «bruker»-turer som pares med de ekte referansebrevene (eid av
// utkast-stemme.ts — ingen duplisering av selve brevteksten her, kun
// saksbeskrivelsene som danner konteksten svarene ble skrevet i). Sendes som
// ekte user/assistant-turer (few-shot) siden det viste seg å kondisjonere
// stilen langt bedre enn å bare beskrive den i systemprompten.
const FS_BESTRID_HELT: FewShot = {
  bruker: `Brevet det svares på:

Betalingsoppfordring fra Pulsløft Treningssenter AS. Saksnummer FK-2026-88213. Datert 12. juli 2026. Krever 3 243,20 kr for medlemskap januar–mars 2026.

Det personen selv oppgir: sa opp i november, har eposten som bevis

Navnet mitt: Kari Eksempel`,
  svar: REFERANSEBREV.innsigelse,
};

const FS_BESTRID_DELVIS: FewShot = {
  bruker: `Brevet det svares på:

Betalingsoppfordring. Saksnummer KY-2026-3341. Datert 13. juli 2026. Hovedkrav 2 400 kr. Inkassosalær 800 kr.

Fakta fra Medhold: Inkassosalæret på 800 kr overstiger lovlig maksimalsats. Høyeste tillatte salær for et krav i denne størrelsen er 750 kr.

Personen har ikke oppgitt utfyllende detaljer.

Navnet mitt: Kari Eksempel`,
  svar: REFERANSEBREV_TILLEGG.innsigelseDelvis,
};

const FS_NEDBETALING: FewShot = {
  bruker: `Brevet det svares på:

Betalingsoppfordring. Saksnummer FK-2026-88213. Datert 12. juli 2026. Krav 3 243,20 kr.

Fakta fra Medhold: Nedbetalingsforslag: 500 kr per måned i 7 måneder (siste avdrag 243,20 kr).

Personen har ikke oppgitt utfyllende detaljer.

Navnet mitt: Kari Eksempel`,
  svar: REFERANSEBREV.nedbetalingsavtale,
};

const FS_UTSETTELSE: FewShot = {
  bruker: `Brevet det svares på:

Inkassovarsel. Saksnummer AG-2026-04471. Datert 10. juli 2026. Betalingsfrist 24. juli 2026.

Det personen selv oppgir: får lønn 15.

Navnet mitt: Kari Eksempel`,
  svar: REFERANSEBREV.betalingsutsettelse,
};

// Klage gjenbruker bestrid-helt-eksempelet som stilreferanse (§2 — ingen
// egen mal denne runden).
const EKSEMPLER: Record<UtkastType, FewShot[]> = {
  innsigelse: [FS_BESTRID_HELT, FS_BESTRID_DELVIS],
  betalingsutsettelse: [FS_UTSETTELSE],
  nedbetalingsavtale: [FS_NEDBETALING],
  klage: [FS_BESTRID_HELT],
};

async function genererTekst(
  anthropic: Anthropic,
  system: string,
  meldinger: { role: "user" | "assistant"; content: string }[],
): Promise<string | null> {
  const svar = await anthropic.messages.create({
    model: AI_MODELL,
    max_tokens: 1500,
    thinking: { type: "disabled" },
    system,
    messages: meldinger,
  });
  const blokk = svar.content.find((b) => b.type === "text");
  if (!blokk || blokk.type !== "text") return null;
  return fjernStjerner(blokk.text);
}

export async function lagUtkast(
  sakId: string,
  brevId: string | null,
  type: UtkastType,
  detaljer: string,
  navn: string,
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

  // Stadium avgjør om nedbetalingsforslaget svarer på rettslig inndriving
  // (forliksråd/namsmann) — kode beslutter hvilket mønster som gjelder, ikke AI.
  const { data: sak } = await supabase
    .from("saker")
    .select("stadium")
    .eq("id", sakId)
    .maybeSingle();
  const rettslig =
    sak?.stadium === "forliksrad" || sak?.stadium === "namsmann";

  const detalj = detaljer.trim();
  const navnTrimmet = navn.trim();

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
- Dette er et FORSLAG om nedbetalingsavtale, ikke en bestridelse av kravet. Bruk avdragsforslaget fra «Fakta fra Medhold» ORDRETT (nøyaktig månedsbeløp, antall måneder og siste avdrag). Hold en verdig, saklig tone — ingen bønnfallelse, og ikke oppgi grunner personen ikke selv har skrevet.`
      : "";
  const rettsligRegel =
    type === "nedbetalingsavtale" && rettslig
      ? `
- Saken er i stadiet «${sak?.stadium}» — rettslig inndriving er varslet eller igangsatt. Brevet MÅ inneholde disse tre punktene, som en kort strekliste: (1) be om skriftlig bekreftelse på om nedbetalingsplanen godtas, (2) be om at forliksklage og videre inndriving settes på vent mens forslaget vurderes, (3) be om at det ikke legges til nye omkostninger i denne perioden. Følg mønsteret i «Fasit ved rettslig varsel» under — fyll inn sakens egne verdier for {}-feltene, ta ALDRI med selve klammeparentesene i svaret.

Fasit ved rettslig varsel (mønster, ikke ordrett tekst):

${REFERANSEBREV_TILLEGG.nedbetalingRettslig}`
      : "";
  const navnRegel = navnTrimmet
    ? `
- Avslutt brevet med «Vennlig hilsen» og deretter navnelinjen «${navnTrimmet}» nøyaktig — aldri et annet eller oppdiktet navn.`
    : `
- Avslutt brevet med kun «Vennlig hilsen», uten navnelinje under (ikke oppgitt navn — finn aldri på et).`;

  const system = `Du skriver et utkast til ${FORMÅL[type]} på vegne av en privatperson som har fått et brev om gjeld/inkasso.

${TONEREGLER}

${MOTEKSEMPEL}

Ufravikelige regler:
- Skriv KUN ren tekst, klar til å limes rett inn i en e-post. INGEN markdown: ingen stjerner (*), ingen fet skrift, ingen overskrifter (#). Bruk vanlig bindestrek (-) for korte handlingslister, aldri stjerner.
- Bruk KUN fakta fra brevet, det personen selv oppgir, og fakta fra Medhold når det er oppgitt. Finn ALDRI opp beløp, datoer, paragrafer, navn eller omstendigheter.
- Nevn ikke forhold personen ikke har oppgitt. Er noe uklart, hold det generelt fremfor å gjette.
- Ikke gi garantier om utfallet. Ikke lat som du er advokat.${gebyrRegel}${avtaleRegel}${rettsligRegel}${navnRegel}
- IKKE ta med emnelinjen (linjen som starter med «Emne:») i svaret ditt, selv om referansebrevene har den — appen bygger emnelinjen selv. Start rett på «Hei,».
- Skriv kun selve brevteksten (ingen forklaring rundt, ingen «her er utkastet»).
- Eksemplene i samtalen viser ønsket tone, lengde og struktur. Navn, beløp, datoer og saksnumre i eksemplene er kun illustrasjon — bruk alltid sakens faktiske verdier, aldri eksemplenes.`;

  const bruker = [
    original ? `Brevet det svares på:\n\n${original}` : null,
    gebyrFakta ? `Fakta fra Medhold: ${gebyrFakta}` : null,
    avdragFakta ? `Fakta fra Medhold: ${avdragFakta}` : null,
    detalj
      ? `Det personen selv oppgir: ${detalj}`
      : "Personen har ikke oppgitt utfyllende detaljer.",
    navnTrimmet ? `Navnet mitt: ${navnTrimmet}` : null,
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
    const meldinger = [
      ...fewShotMeldinger,
      { role: "user" as const, content: bruker },
    ];
    let tekst = await genererTekst(anthropic, system, meldinger);
    if (tekst === null)
      return { ok: false, feil: "Fikk ikke et brukbart utkast. Prøv igjen." };

    // Etterkontroll: «AI tolker, kode beslutter» — også for stil. Treff på
    // forbudslisten eller for langt utkast → ÉN regenerering (ikke en løkke,
    // av kostnadshensyn). Fortsatt treff etterpå → behold og logg, ikke blokkér.
    const treff = finnForbudteOrd(tekst);
    const ordtall = tellOrd(tekst);
    if (treff.length > 0 || ordtall > 300) {
      const problemer: string[] = [];
      if (treff.length > 0)
        problemer.push(
          `Disse ordene/frasene forekommer og MÅ bort: ${treff.join(", ")}.`,
        );
      if (ordtall > 300)
        problemer.push(
          `Brevet er ${ordtall} ord — for langt. Kort det ned til under 200 ord.`,
        );
      const rettemelding = `Utkastet ditt har feil:\n- ${problemer.join("\n- ")}\n\nSkriv HELE brevet på nytt med samme fakta, rettet. Kun brevteksten, ingen forklaring.`;
      const meldinger2 = [
        ...meldinger,
        { role: "assistant" as const, content: tekst },
        { role: "user" as const, content: rettemelding },
      ];
      const tekst2 = await genererTekst(anthropic, system, meldinger2);
      if (tekst2 !== null) {
        const treff2 = finnForbudteOrd(tekst2);
        if (treff2.length > 0) {
          console.error(
            `[lagUtkast] Forbudte ord slapp gjennom etter regenerering (type=${type}): ${treff2.join(", ")}`,
          );
        }
        tekst = tekst2;
      }
    }
    innhold = tekst;
  } catch (e) {
    console.error("[lagUtkast] AI-generering feilet:", e);
    return { ok: false, feil: "Noe gikk galt. Prøv igjen om litt." };
  }

  // Husk navnet til neste gang (§6). Best-effort — skal aldri velte
  // utkastgenereringen selv om denne skulle feile.
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
