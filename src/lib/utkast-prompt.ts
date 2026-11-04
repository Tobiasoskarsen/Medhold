// Prompten for utkastgenerering, uten database eller Next-kontekst
// (MEDHOLD_SIKKERHET_ARBEIDSORDRE §D.1, §D.3, §E.4). Ren funksjon av sakens
// fakta: brukes av utkast/actions.ts (byggUtkastPrompt henter fakta fra
// databasen og kaller hit), streaming-ruten og scripts/fasit-utkast.ts — så
// fasiten måler nøyaktig samme prompt og etterkontroll som appen.
// Relative importer med .ts-endelse, så filen også kan kjøres direkte av Node.
import type Anthropic from "@anthropic-ai/sdk";
import type { UtkastType } from "./types";
import { gebyrFunnTekst, type GebyrsjekkResultat } from "./gebyr.ts";
import type { AvdragsForslag } from "./avdrag";
import { AI_MODELL } from "./ai.ts";
import { tellOrd } from "./format.ts";
import {
  TONEREGLER,
  REFERANSEBREV,
  REFERANSEBREV_TILLEGG,
  MOTEKSEMPEL,
  finnForbudteOrd,
} from "./utkast-stemme.ts";
import { kontrollerUtkast, type VaktFakta, type VaktFunn } from "./utkast-vakt.ts";

export type Omfang = "delvis" | "helt";

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Sikkerhetsnett mot markdown i et brev som limes inn som ren tekst. Fjerner
 * stjerne-punktlister i linjestart og alle gjenværende stjerner (fet/kursiv).
 * Brev på norsk inneholder praktisk talt aldri legitime stjerner.
 */
export function fjernStjerner(tekst: string): string {
  return tekst
    .replace(/^[ \t]*\*[ \t]+/gm, "")
    .replace(/\*/g, "")
    .trim();
}

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

// Meldingsformen brukt overalt her — smalere enn `Anthropic.MessageParam`
// (som også tillater "system"-rolle og content-blokker), siden alt her
// alltid er plain user/assistant-tekst.
export type UtkastMelding = { role: "user" | "assistant"; content: string };

/** Sum kr over lovlig sats i et gebyrsjekk-resultat (kun «over»-linjer). */
export function gebyrDifferanse(gs: GebyrsjekkResultat | null): number {
  if (!gs) return 0;
  return gs.linjer
    .filter((l) => l.vurdering === "over")
    .reduce((s, l) => s + (l.differanse ?? 0), 0);
}

/**
 * Omfanget som faktisk gjelder (kode beslutter): «delvis» er bare mulig for
 * en innsigelse når gebyrsjekken fant noe over sats. Uten gebyrfunn er en
 * innsigelse alltid «helt»; andre utkasttyper bestrider ikke kravet (null).
 */
export function gjeldendeOmfang(
  type: UtkastType,
  gs: GebyrsjekkResultat | null,
  valgt: Omfang | null | undefined,
): Omfang | null {
  if (type !== "innsigelse") return null;
  if ((gs?.antallOver ?? 0) === 0) return "helt";
  return valgt === "helt" ? "helt" : "delvis";
}

/** Den ubestridte delen ved delvis innsigelse: total minus beløpet over sats. */
export function ubestridtDel(
  total: number | null,
  gs: GebyrsjekkResultat | null,
): number | null {
  const diff = gebyrDifferanse(gs);
  if (total === null || diff <= 0) return null;
  const rest = Math.round((total - diff) * 100) / 100;
  return rest > 0 ? rest : null;
}

export type UtkastGrunnlag = {
  type: UtkastType;
  originalTekst: string;
  gebyrsjekk: GebyrsjekkResultat | null;
  stadium: string | null;
  /** Kravets totalbeløp (saken, ellers brevet) — grunnlag for ubestridt del. */
  belopTotalt: number | null;
  detaljer: string;
  navn: string;
  avdrag: AvdragsForslag | null;
  /** Fra gjeldendeOmfang(). */
  omfang: Omfang | null;
};

/**
 * Bygger system-prompt og few-shot-meldinger for et utkast. Ren funksjon:
 * alle fakta kommer inn som argument, ingenting hentes her.
 */
export function byggPrompt(g: UtkastGrunnlag): {
  system: string;
  meldinger: UtkastMelding[];
} {
  // Kun «over»-funn sendes til prompten (kode beslutter, ikke AI). mulig_over
  // og ukjent holdes utenfor — konservativt.
  const gebyrFakta =
    g.gebyrsjekk && g.gebyrsjekk.antallOver > 0 ? gebyrFunnTekst(g.gebyrsjekk) : "";

  // Stadium avgjør om nedbetalingsforslaget svarer på rettslig inndriving
  // (forliksråd/namsmann) — kode beslutter hvilket mønster som gjelder, ikke AI.
  const rettslig = g.stadium === "forliksrad" || g.stadium === "namsmann";

  const detalj = g.detaljer.trim();
  const navnTrimmet = g.navn.trim();
  const delvis = g.type === "innsigelse" && g.omfang === "delvis";
  const diff = gebyrDifferanse(g.gebyrsjekk);
  const ubestridt = ubestridtDel(g.belopTotalt, g.gebyrsjekk);

  const gebyrRegel = gebyrFakta
    ? `
- Appen har gjort en automatisk kontroll mot inkassoforskriftens maksimalsatser (se «Fakta fra Medhold» under). Du KAN vise til at det aktuelle beløpet overstiger den lovlige maksimalsatsen etter inkassoforskriften, men oppgi ALDRI paragrafnummer, og hold tonen rolig og saklig — ikke skjerp den.`
    : "";

  // Delvis innsigelse (§D.1): bestrid KUN beløpet over sats, og si at resten
  // betales — ellers risikerer personen nye kostnader på en del de ikke
  // bestrider.
  const omfangFakta = delvis
    ? ubestridt !== null
      ? `Personen bestrider kun ${kr(diff)} kr. Den ubestridte delen er ${kr(ubestridt)} kr.`
      : `Personen bestrider kun ${kr(diff)} kr.`
    : "";
  const omfangRegel = delvis
    ? `
- Brevet bestrider KUN ${kr(diff)} kr, beløpet over maksimalsatsen. ${
        ubestridt !== null
          ? `Skriv at personen betaler den ubestridte delen på ${kr(ubestridt)} kr`
          : "Skriv at personen betaler den ubestridte delen"
      }, og be om et korrigert krav. Skriv ALDRI at personen ikke betaler kravet.`
    : "";

  // Avdragsforslag fra koden (Veier ut → avdragshjelperen). Kun for
  // nedbetalingsavtale, og kun tallene — ingen begrunnelse legges til.
  const avdragFakta =
    g.type === "nedbetalingsavtale" && g.avdrag && g.avdrag.antallMandeder > 0
      ? `Nedbetalingsforslag: ${kr(g.avdrag.manedsbelop)} kr per måned i ${g.avdrag.antallMandeder} måneder (siste avdrag ${kr(g.avdrag.sisteAvdrag)} kr).`
      : "";
  const avtaleRegel =
    g.type === "nedbetalingsavtale"
      ? `
- Dette er et FORSLAG om nedbetalingsavtale, ikke en bestridelse av kravet. Bruk avdragsforslaget fra «Fakta fra Medhold» ORDRETT (nøyaktig månedsbeløp, antall måneder og siste avdrag). Hold en verdig, saklig tone — ingen bønnfallelse, og ikke oppgi grunner personen ikke selv har skrevet.`
      : "";
  const rettsligRegel =
    g.type === "nedbetalingsavtale" && rettslig
      ? `
- Saken er i stadiet «${g.stadium}» — rettslig inndriving er varslet eller igangsatt. Brevet MÅ inneholde disse tre punktene, som en kort strekliste: (1) be om skriftlig bekreftelse på om nedbetalingsplanen godtas, (2) be om at forliksklage og videre inndriving settes på vent mens forslaget vurderes, (3) be om at det ikke legges til nye omkostninger i denne perioden. Følg mønsteret i «Fasit ved rettslig varsel» under — fyll inn sakens egne verdier for {}-feltene, ta ALDRI med selve klammeparentesene i svaret.

Fasit ved rettslig varsel (mønster, ikke ordrett tekst):

${REFERANSEBREV_TILLEGG.nedbetalingRettslig}`
      : "";
  const navnRegel = navnTrimmet
    ? `
- Avslutt brevet med «Vennlig hilsen» og deretter navnelinjen «${navnTrimmet}» nøyaktig — aldri et annet eller oppdiktet navn.`
    : `
- Avslutt brevet med kun «Vennlig hilsen», uten navnelinje under (ikke oppgitt navn — finn aldri på et).`;

  const system = `Du skriver et utkast til ${FORMÅL[g.type]} på vegne av en privatperson som har fått et brev om gjeld/inkasso.

${TONEREGLER}

${MOTEKSEMPEL}

Ufravikelige regler:
- Skriv KUN ren tekst, klar til å limes rett inn i en e-post. INGEN markdown: ingen stjerner (*), ingen fet skrift, ingen overskrifter (#). Bruk vanlig bindestrek (-) for korte handlingslister, aldri stjerner.
- Bruk KUN fakta fra brevet, det personen selv oppgir, og fakta fra Medhold når det er oppgitt. Finn ALDRI opp beløp, datoer, paragrafer, navn eller omstendigheter.
- Nevn ikke forhold personen ikke har oppgitt. Er noe uklart, hold det generelt fremfor å gjette.
- Skriv bare at personen har betalt, sagt opp, klaget, ikke mottatt noe, eller har kvittering, dokumentasjon, vedlegg eller bekreftelse, når personen selv har skrevet det. Vil du be kreditor dokumentere kravet, skriv for eksempel «Send meg avtalen kravet bygger på» — uten ordene «dokumentasjon», «kvittering» eller «bekreftelse».
- Ikke gi garantier om utfallet. Ikke lat som du er advokat.${gebyrRegel}${omfangRegel}${avtaleRegel}${rettsligRegel}${navnRegel}
- IKKE ta med emnelinjen (linjen som starter med «Emne:») i svaret ditt, selv om referansebrevene har den — appen bygger emnelinjen selv. Start rett på «Hei,».
- Skriv kun selve brevteksten (ingen forklaring rundt, ingen «her er utkastet»).
- Eksemplene i samtalen viser ønsket tone, lengde og struktur. Navn, beløp, datoer og saksnumre i eksemplene er kun illustrasjon — bruk alltid sakens faktiske verdier, aldri eksemplenes.`;

  const bruker = [
    g.originalTekst ? `Brevet det svares på:\n\n${g.originalTekst}` : null,
    gebyrFakta ? `Fakta fra Medhold: ${gebyrFakta}` : null,
    omfangFakta ? `Fakta fra Medhold: ${omfangFakta}` : null,
    avdragFakta ? `Fakta fra Medhold: ${avdragFakta}` : null,
    detalj
      ? `Det personen selv oppgir: ${detalj}`
      : "Personen har ikke oppgitt utfyllende detaljer.",
    navnTrimmet ? `Navnet mitt: ${navnTrimmet}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Delvis innsigelse: delvis-brevet er ENESTE eksempel, så modellen ikke
  // låner «betaler det ikke» fra bestrid-helt-eksempelet.
  const eksempler = delvis ? [FS_BESTRID_DELVIS] : EKSEMPLER[g.type];
  // Emnelinjen fjernes fra eksempelsvarene: regelen sier at modellen ikke
  // skal skrive den, men eksempler veier tyngre enn regler — fasitkjøringen
  // (§E.4) viste «Emne:» i 20 av 20 utkast så lenge eksemplene hadde den.
  const fewShotMeldinger: UtkastMelding[] = eksempler.flatMap((ex) => [
    { role: "user" as const, content: ex.bruker },
    { role: "assistant" as const, content: ex.svar.replace(/^Emne:.*\n+/, "") },
  ]);

  return {
    system,
    meldinger: [...fewShotMeldinger, { role: "user" as const, content: bruker }],
  };
}

// --- Etterkontroll (én regenerering, aldri en løkke) -------------------------

/** Over dette regenereres utkastet (målet i prompten er under 200 ord). */
export const ORDTAK_REGENERERING = 300;

/**
 * Alt som skal rettes i ÉN regenerering: forbudte ord, lengde og vaktfunnene
 * (§D.3). Tom `problemer` = ingen regenerering.
 */
export function etterkontroll(
  tekst: string,
  fakta: VaktFakta,
): { problemer: string[]; vaktFunn: VaktFunn[] } {
  const problemer: string[] = [];
  const treff = finnForbudteOrd(tekst);
  if (treff.length > 0)
    problemer.push(`Disse ordene/frasene forekommer og MÅ bort: ${treff.join(", ")}.`);
  const ordtall = tellOrd(tekst);
  if (ordtall > ORDTAK_REGENERERING)
    problemer.push(`Brevet er ${ordtall} ord — for langt. Kort det ned til under 200 ord.`);
  const vaktFunn = kontrollerUtkast(tekst, fakta);
  for (const f of vaktFunn) problemer.push(f.rettelinje);
  return { problemer, vaktFunn };
}

export function rettemelding(problemer: string[]): string {
  return `Utkastet ditt har feil:\n- ${problemer.join("\n- ")}\n\nSkriv HELE brevet på nytt med samme fakta, rettet. Kun brevteksten, ingen forklaring.`;
}

async function genererTekst(
  anthropic: Anthropic,
  system: string,
  meldinger: UtkastMelding[],
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

/**
 * Genererer et utkast med etterkontroll: funn → ÉN regenerering med alle
 * rettelsene, deretter vakten på nytt. Det som fortsatt står igjen returneres
 * som `advarsler` — utkastet blokkeres aldri (guardrail 5). Null = modellen
 * ga ikke et brukbart første svar. Kaster ved API-feil.
 */
export async function genererUtkast(
  anthropic: Anthropic,
  prompt: { system: string; meldinger: UtkastMelding[] },
  fakta: VaktFakta,
): Promise<{
  tekst: string;
  advarsler: VaktFunn[];
  regenerert: boolean;
  /** Det som utløste regenereringen (tom når den ikke trengtes). */
  problemer: string[];
} | null> {
  let tekst = await genererTekst(anthropic, prompt.system, prompt.meldinger);
  if (tekst === null) return null;

  const { problemer, vaktFunn } = etterkontroll(tekst, fakta);
  if (problemer.length === 0)
    return { tekst, advarsler: vaktFunn, regenerert: false, problemer };

  const tekst2 = await genererTekst(anthropic, prompt.system, [
    ...prompt.meldinger,
    { role: "assistant", content: tekst },
    { role: "user", content: rettemelding(problemer) },
  ]);
  if (tekst2 !== null) tekst = tekst2;
  return {
    tekst,
    advarsler: kontrollerUtkast(tekst, fakta),
    regenerert: true,
    problemer,
  };
}
