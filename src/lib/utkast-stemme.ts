// Medholds brevstemme — all tekst som styrer TONEN i AI-genererte utkast bor
// her (MEDHOLD_UTKAST_STEMME_ARBEIDSORDRE.md), importert av prompt-byggeren
// i utkast/actions.ts. «AI tolker, kode beslutter» — også for stil: denne
// filen er ren tekst og ren funksjon, ingen AI.
import type { UtkastType } from "./types";

/** Ord/fraser som aldri skal forekomme i et generert utkast. */
export const FORBUDTE_ORD: string[] = [
  "anmodning",
  "anmoder",
  "vedrørende",
  "herved",
  "undertegnede",
  "imøteser",
  "i bero",
  "fremsettes",
  "fremsette",
  "ovennevnte",
  "på bakgrunn av dette",
  "besørge",
  "angjeldende",
  "erlegge",
  "viser til",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bygger en ordgrense-bevisst regex for en (evt. flerords) frase. Bruker
 * Unicode-bokstavklasser i grensene, slik at norske bokstaver (æøå) telles
 * som ordtegn — ellers ville «\b» kunne gi falske treff/ikke-treff rundt dem. */
function fraseRegex(frase: string): RegExp {
  const mønster = escapeRegex(frase).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${mønster}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Returnerer forbudte ord/fraser funnet i teksten (case-insensitivt,
 * ordgrense-bevisst så «beroende» o.l. ikke gir falsk treff på «i bero»).
 */
export function finnForbudteOrd(tekst: string): string[] {
  return FORBUDTE_ORD.filter((ord) => fraseRegex(ord).test(tekst));
}

export const TONEREGLER = `Toneregler for brevet:
1. Under 200 ord totalt. Ingen setning over cirka 20 ord. Avsnitt på maks tre setninger.
2. «Jeg» er subjektet. Aktiv form hele veien.
3. Konklusjonen (enig/uenig/forslaget) kommer i andre avsnitt, før begrunnelsen.
4. Fakta med datoer og beløp — aldri karakteristikker som «urimelig» eller «uakseptabelt».
5. Be om konkrete handlinger i imperativ («Bekreft skriftlig …», «Sett … på vent», «Ikke legg til …»). Kort strekliste (med "-") ved tre eller flere punkter, ellers løpende tekst.
6. Ord fra forbudslisten under skal ALDRI forekomme.
7. Brukerens formuleringer fra detaljfeltet skal kunne kjennes igjen i brevet — ryddet for skrivefeil, ikke oversatt til kontorspråk.
8. Ingen unnskyldninger, ingen «håper på forståelse», ingen utropstegn.
9. Ren tekst, ingen markdown.
10. Bokmål.

Forbudt (skal ALDRI forekomme, i noen bøyning eller sammenheng): ${FORBUDTE_ORD.join(", ")}.`;

const BREV_1 = `Emne: Innsigelse mot krav — saksnr. FK-2026-88213

Hei,

Jeg har mottatt betalingsoppfordringen deres datert 12. juli 2026, med krav på 3 243,20 kr på vegne av Pulsløft Treningssenter AS.

Jeg er uenig i kravet og betaler det ikke.

Kravet gjelder medlemskap for januar til mars 2026. Jeg sa opp medlemskapet skriftlig 28. november 2025 og har e-postbekreftelse på at oppsigelsen ble mottatt. Med én måneds oppsigelsestid var medlemskapet avsluttet 31. desember 2025. Det er derfor ikke grunnlag for å fakturere meg for januar, februar og mars.

Kravet er dermed omtvistet og kan ikke drives inn ved ordinær inkasso. Jeg ber om at dere:
- registrerer kravet som omtvistet og stanser videre inndriving
- bekrefter dette skriftlig
- enten avslutter saken eller sender den til forliksrådet, hvis dere mener kravet står seg

Dokumentasjonen sender jeg gjerne ved behov.

Vennlig hilsen
Kari Eksempel`;

// «Jeg viser til» byttet til «Jeg har mottatt» i Brev 2–4 (jf. §1s forbudsliste,
// som nå forbyr «viser til» — Brev 5 i denne ordren bruker allerede «har
// mottatt». Note: avvik fra MEDHOLD_REFERANSEBREV.md ordrett, se PROSJEKT_STATUS.
const BREV_2 = `Emne: Innsigelse mot inkassosalæret — saksnr. KY-2026-3341

Hei,

Jeg har mottatt betalingsoppfordringen deres datert 13. juli 2026.

Hovedkravet på 2 400 kr er jeg enig i, og det betaler jeg innen fristen.

Inkassosalæret på 800 kr er jeg uenig i. Høyeste tillatte salær etter inkassoforskriften er 750 kr for et krav på denne størrelsen. Salæret er altså 50 kr over lovlig maksimalsats, og denne delen av kravet er omtvistet til den er korrigert.

Jeg ber om at dere retter salæret og sender meg en oppdatert oppstilling.

Vennlig hilsen
Kari Eksempel`;

const BREV_3 = `Emne: Forslag til nedbetalingsavtale — saksnr. FK-2026-88213

Hei,

Jeg har mottatt betalingsoppfordringen deres datert 12. juli 2026. Kravet på 3 243,20 kr er riktig, og jeg vil gjøre opp for meg.

Jeg klarer ikke å betale alt på én gang. Jeg foreslår derfor 500 kr i måneden i sju måneder, med første betaling 1. august 2026 og et siste avdrag på 243,20 kr.

Kan dere bekrefte skriftlig om dere godtar forslaget? Jeg ber også om at saken ikke sendes videre mens dere vurderer det.

Vennlig hilsen
Kari Eksempel`;

const BREV_4 = `Emne: Ber om utsatt betalingsfrist — saksnr. AG-2026-04471

Hei,

Jeg har mottatt inkassovarselet deres datert 10. juli 2026, med betalingsfrist 24. juli. Kravet er riktig, og jeg skal betale hele beløpet.

Jeg rekker ikke fristen, men kan betale alt 15. august, rett etter lønning. Jeg ber derfor om utsatt frist til denne datoen.

Kan dere bekrefte skriftlig at det er i orden?

Vennlig hilsen
Kari Eksempel`;

const BREV_5 = `Til {inkassoselskap} — saksnr. {saksnr}

Jeg har mottatt varselet deres datert {dato} om rettslig inndriving.

Jeg bestrider ikke kravet på {beløp}, men jeg kan ikke betale hele beløpet på én gang. Jeg foreslår å betale {månedsbeløp} per måned i {antall} måneder, med et siste avdrag på {siste avdrag}.

Jeg ber om følgende:
- Bekreft skriftlig om dere godtar nedbetalingsplanen.
- Sett forliksklage og videre inndriving på vent mens forslaget vurderes.
- Ikke legg til nye omkostninger i denne perioden.

Vennlig hilsen
{navn}`;

/** Referansebrevene i §2, ett hovedeksempel per utkasttype (brevene legges
 * inn ordrett fra MEDHOLD_REFERANSEBREV.md, se avviksnotat over). */
export const REFERANSEBREV: Record<UtkastType, string> = {
  innsigelse: BREV_1,
  betalingsutsettelse: BREV_4,
  nedbetalingsavtale: BREV_3,
  // Ingen egen mal for klage denne runden — gjenbruker Brev 1 som stilreferanse (§2).
  klage: BREV_1,
};

/** Tilleggsmønstre som ikke er hovedeksempelet for typen, men som skal med i
 * prompten når saken passer (§2): delvis bestrid for innsigelse, og
 * nedbetalingsforslag som svar på rettslig inndriving. */
export const REFERANSEBREV_TILLEGG = {
  innsigelseDelvis: BREV_2,
  nedbetalingRettslig: BREV_5,
} as const;

export const MOTEKSEMPEL = `SLIK SKRIVER VI IKKE (fra appens egen tidligere output):
«Jeg viser til varselet deres datert 15. juli 2026 om rettslig inndriving. Jeg bestrider ikke kravet, men har ikke mulighet til å betale hele beløpet umiddelbart. Jeg ønsker derfor å foreslå en nedbetalingsavtale … Jeg ber om følgende: Skriftlig bekreftelse på om betalingsplanen kan godtas.»
Passivt og substantivtungt, med dobbel innpakning («ønsker å foreslå»). Bruk referansebrevenes direkte form i stedet.`;
