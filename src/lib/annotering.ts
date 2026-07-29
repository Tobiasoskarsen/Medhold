// Annotert brev (MEDHOLD_SUBSTANS_ARBEIDSORDRE §4). Rent tekstsøk etter
// verdier appen ALLEREDE har trukket ut — ingen tolkning, ingen AI, ingen
// fuzzy matching eller generell beløp-gjenkjenning (guardrail 5). Finner vi
// ikke strengen slik den faktisk står i brevteksten, hopper vi over den.

import type { Kostnadslinje, GebyrsjekkResultat, Kostnadstype } from "./gebyr";

export type Annotering = {
  start: number; // indeks i brevteksten
  slutt: number;
  etikett: string; // «Inkassosalær — 50 kr over lovlig sats»
  type: "funn" | "kostnad" | "dato" | "belop";
};

const KOSTNADSNAVN: Record<Kostnadstype, string> = {
  purregebyr: "Purregebyr",
  inkassovarselgebyr: "Inkassovarselgebyr",
  betalingsoppfordringsgebyr: "Betalingsoppfordringsgebyr",
  salaer: "Inkassosalær",
  forsinkelsesrente: "Forsinkelsesrente",
  rettsgebyr: "Rettsgebyr",
  annet: "Kostnad",
};

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Prøver et lite, FAST sett kandidat-strenger for et beløp — aldri en
 * generell «finn tall»-regex (guardrail 5). Første som finnes i teksten
 * vinner: Intl-formatert («2 400», med vanlig ikke-brytende mellomrom),
 * samme med vanlig mellomrom (slik limt/OCR-tekst oftest er), og til slutt
 * rene sifre uten skilletegn («2400» — dekker beløp under 1000 direkte).
 */
function finnBelopPosisjon(
  tekst: string,
  belop: number,
): { start: number; slutt: number } | null {
  const intlFormatert = new Intl.NumberFormat("nb-NO", {
    maximumFractionDigits: 2,
  }).format(belop);
  const kandidater = [
    intlFormatert,
    intlFormatert.replace(/ /g, " "),
    String(belop),
  ];
  for (const kandidat of kandidater) {
    const start = tekst.indexOf(kandidat);
    if (start !== -1) return { start, slutt: start + kandidat.length };
  }
  return null;
}

/**
 * Prøver et lite, FAST sett kandidat-datoformater for en ISO-dato
 * (YYYY-MM-DD) — «10.7.2026», «10.07.2026» og den lange norske formen
 * («10. juli 2026»). Aldri gjetting utover disse konkrete, deterministiske
 * formatene.
 */
function finnDatoPosisjon(
  tekst: string,
  isoDato: string,
): { start: number; slutt: number } | null {
  const [år, mnd, dag] = isoDato.split("-").map(Number);
  if (!år || !mnd || !dag) return null;
  const lang = new Date(isoDato).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const kandidater = [
    `${dag}.${mnd}.${år}`,
    `${String(dag).padStart(2, "0")}.${String(mnd).padStart(2, "0")}.${år}`,
    lang,
  ];
  for (const kandidat of kandidater) {
    const start = tekst.indexOf(kandidat);
    if (start !== -1) return { start, slutt: start + kandidat.length };
  }
  return null;
}

/**
 * Finner posisjonene til kjente verdier i brevteksten. Rent tekstsøk — ingen
 * tolkning, ingen AI. Første treff per verdi; overlappende annoteringer
 * beholder kun den med lavest `start` (sortert stigende på start).
 */
export function finnAnnoteringer(
  brevtekst: string,
  kostnadslinjer: Kostnadslinje[],
  gebyrsjekk: GebyrsjekkResultat | null,
  hovedstol: number | null,
  belopTotalt: number | null,
  frister: { tittel: string; forfallsdato: string }[],
): Annotering[] {
  const kandidater: Annotering[] = [];

  // Kostnadslinjer: søk etter linjen slik AI-en trakk den ut (samme
  // rekkefølge som gebyrsjekk.linjer, jf. sjekkKostnader) — teksten skal
  // stå ordrett i brevet siden det er nettopp det AI-en ble bedt om å
  // gjengi (actions.ts). Finnes en vurdering, gjenbrukes dens kodegenererte
  // forklaring som etikett — ingen ny tekst dikkes opp her.
  kostnadslinjer.forEach((linje, i) => {
    if (!linje.tekst) return;
    const start = brevtekst.indexOf(linje.tekst);
    if (start === -1) return;
    const resultatLinje = gebyrsjekk?.linjer[i];
    kandidater.push({
      start,
      slutt: start + linje.tekst.length,
      etikett: resultatLinje
        ? resultatLinje.forklaring
        : `${KOSTNADSNAVN[linje.type]}: ${kr(linje.belop)} kr`,
      type: resultatLinje?.vurdering === "over" ? "funn" : "kostnad",
    });
  });

  if (hovedstol !== null) {
    const treff = finnBelopPosisjon(brevtekst, hovedstol);
    if (treff) {
      kandidater.push({
        ...treff,
        etikett: `Hovedstol — ${kr(hovedstol)} kr`,
        type: "belop",
      });
    }
  }

  if (belopTotalt !== null) {
    const treff = finnBelopPosisjon(brevtekst, belopTotalt);
    if (treff) {
      kandidater.push({
        ...treff,
        etikett: `Totalt beløp — ${kr(belopTotalt)} kr`,
        type: "belop",
      });
    }
  }

  for (const f of frister) {
    const treff = finnDatoPosisjon(brevtekst, f.forfallsdato);
    if (treff) {
      kandidater.push({ ...treff, etikett: f.tittel, type: "dato" });
    }
  }

  // Overlapp: sorter stigende på start, behold grådig laveste-start-vinneren
  // i hver overlappende klynge (forkast alt som starter før forrige beholdte
  // annotering er ferdig).
  const sortert = [...kandidater].sort((a, b) => a.start - b.start);
  const resultat: Annotering[] = [];
  let sisteSlutt = -1;
  for (const a of sortert) {
    if (a.start < sisteSlutt) continue;
    resultat.push(a);
    sisteSlutt = a.slutt;
  }
  return resultat;
}
