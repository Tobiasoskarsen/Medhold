// Stadium- og fristmotor for gjeld/inkasso. Ren, deterministisk kode uten
// sideeffekter — «AI tolker, kode beslutter». Frister som følger av regler
// beregnes her og merkes kilde='beregnet'. Ingen fakta finnes opp.
//
// Kilder for fristreglene: inkassoloven §§ 9–10 (14 dagers betalings-/svarfrist).

/** Stadiene et gjeldskrav kan være i, i eskalerende rekkefølge (4.1). */
export const STADIER = [
  "faktura",
  "purring",
  "inkassovarsel",
  "betalingsoppfordring",
  "forliksrad",
  "namsmann",
  "nedbetaling",
  "avsluttet",
] as const;

export type Stadium = (typeof STADIER)[number];

/** Brevtyper AI kan klassifisere til (stadiene + «annet»). */
export const BREVTYPER = [...STADIER, "annet"] as const;
export type BrevType = (typeof BREVTYPER)[number];

/** Visningstekst for et stadium (norsk, små bokstaver som i mockupen). */
export const STADIUM_ETIKETT: Record<Stadium, string> = {
  faktura: "faktura",
  purring: "purring",
  inkassovarsel: "inkassovarsel",
  betalingsoppfordring: "betalingsoppfordring",
  forliksrad: "forliksråd",
  namsmann: "namsmann",
  nedbetaling: "nedbetaling",
  avsluttet: "avsluttet",
};

/**
 * De fem segmentene i StadiumIndikator (3.3). Det siste segmentet dekker
 * både forliksråd og namsmann. Returnerer antall fylte segmenter (1–5).
 */
export function fylteSegmenter(stadium: Stadium): number {
  switch (stadium) {
    case "faktura":
      return 1;
    case "purring":
      return 2;
    case "inkassovarsel":
      return 3;
    case "betalingsoppfordring":
      return 4;
    case "forliksrad":
    case "namsmann":
    case "nedbetaling":
    case "avsluttet":
      return 5;
  }
}

/** Neste stadium i eskaleringen, eller null hvis det ikke finnes flere. */
export function nesteStadium(stadium: Stadium): Stadium | null {
  const i = STADIER.indexOf(stadium);
  if (i < 0 || i >= STADIER.length - 1) return null;
  return STADIER[i + 1];
}

/**
 * Stadiet en gitt brevtype impliserer. «annet» gir null (ukjent). For øvrig
 * er brevtypen selv stadiet (et inkassovarsel bringer saken til stadiet
 * «inkassovarsel»).
 */
export function foreslaStadium(brevtype: BrevType): Stadium | null {
  return brevtype === "annet" ? null : brevtype;
}

/**
 * Kort handlingstittel til «det viktigste nå»-kortet, gitt sakens stadium.
 * Ren tekst — ingen fakta finnes opp.
 */
export function handlingstittel(stadium: Stadium | null): string {
  switch (stadium) {
    case "inkassovarsel":
      return "Svar på inkassovarselet";
    case "betalingsoppfordring":
      return "Svar på betalingsoppfordringen";
    case "purring":
      return "Følg opp purringen";
    case "faktura":
      return "Følg opp fakturaen";
    case "forliksrad":
      return "Følg opp forliksklagen";
    case "namsmann":
      return "Følg opp saken hos namsmannen";
    case "nedbetaling":
      return "Følg opp nedbetalingen";
    default:
      return "Følg opp saken";
  }
}

/**
 * Om det gir mening å lage et svarutkast på dette stadiet (innsigelse/klage/
 * betalingsutsettelse). Brukes til å velge verb på «det viktigste nå»-kortet.
 */
export function stotterUtkast(stadium: Stadium | null): boolean {
  return (
    stadium === "inkassovarsel" ||
    stadium === "betalingsoppfordring" ||
    stadium === "forliksrad" ||
    stadium === "namsmann"
  );
}

/** Legg til et antall dager på en ISO-dato (YYYY-MM-DD). UTC-trygt. */
export function leggTilDager(isoDato: string, dager: number): string {
  const d = new Date(`${isoDato}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

export type BeregnetFrist = {
  tittel: string;
  forfallsdato: string; // YYYY-MM-DD
  kilde: "beregnet";
};

/**
 * Beregner fristen som følger deterministisk av en brevtype og brevdato.
 * Kun to regler i første versjon (inkassoloven §§ 9–10). Returnerer null når
 * ingen regel gjelder — da settes ingen frist automatisk.
 */
export function beregnFrist(
  brevtype: BrevType,
  brevdato: string,
): BeregnetFrist | null {
  switch (brevtype) {
    case "inkassovarsel":
      // § 9: minst 14 dagers betalingsfrist etter at varselet er sendt.
      return {
        tittel: "Betalingsfrist",
        forfallsdato: leggTilDager(brevdato, 14),
        kilde: "beregnet",
      };
    case "betalingsoppfordring":
      // § 10: minst 14 dagers frist til å betale eller komme med innsigelser.
      return {
        tittel: "Svarfrist",
        forfallsdato: leggTilDager(brevdato, 14),
        kilde: "beregnet",
      };
    default:
      return null;
  }
}
