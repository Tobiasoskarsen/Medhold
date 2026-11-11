// Sumkontroll for brevlesingen (MEDHOLD_SIKKERHET_ARBEIDSORDRE §A.1). Ren,
// deterministisk kode — «AI tolker, kode beslutter». AI-en leser totalen,
// hovedstolen og kostnadslinjene hver for seg; her sjekkes det om de går opp
// mot hverandre. Et avvik betyr at noe trolig er feillest (testbrev 13: «Å
// betale 1 288,00 kr» ble lagret som 289), og brukeren bes sjekke tallene.

export type Sumkontroll =
  | { status: "stemmer"; sum: number; total: number }
  | { status: "avvik"; sum: number; total: number; differanse: number }
  | { status: "ukjent" }; // mangler hovedstol eller total

// 1 kr slingring for avrunding i brevet (samme som gebyrsjekken).
const SLINGRING = 1;

/** Øre-presis avrunding, så 0,1 + 0,2 ikke gir falske avvik. */
function rund(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sjekker at hovedstol + summen av kostnadslinjene er lik totalen (±1 kr).
 * `differanse` er total minus sum (positiv = brevet krever mer enn linjene
 * forklarer). Mangler total eller hovedstol → «ukjent», aldri en gjetning.
 */
export function kontrollerSum(
  total: number | null,
  hovedstol: number | null,
  linjer: { belop: number }[],
): Sumkontroll {
  if (total === null || hovedstol === null) return { status: "ukjent" };
  const sum = rund(hovedstol + linjer.reduce((acc, l) => acc + l.belop, 0));
  const differanse = rund(total - sum);
  if (Math.abs(differanse) <= SLINGRING) {
    return { status: "stemmer", sum, total };
  }
  return { status: "avvik", sum, total, differanse };
}

/** Et lagret sumavvik som er et funn: brevet krever mer enn linjene blir. */
export type Sumavvik = { sum: number; total: number; differanse: number };

/**
 * Leser `gebyrsjekk.sumkontroll` fra et lagret brev (lagres av lagreBrev når
 * brukeren har bekreftet «Det stemmer likevel»). Bare når brevet krever MER
 * enn hovedstol og kostnader blir (total − sum > 1 kr), er det et funn.
 * Blir linjene mer enn totalen, er det ikke et funn mot brukeren. Gamle rader
 * uten sumkontroll og data med feil form gir null, aldri en gjetning.
 */
export function sumavvikFra(gebyrsjekk: unknown): Sumavvik | null {
  if (!gebyrsjekk || typeof gebyrsjekk !== "object") return null;
  const s = (gebyrsjekk as { sumkontroll?: unknown }).sumkontroll;
  if (!s || typeof s !== "object") return null;
  const { status, sum, total } = s as Record<string, unknown>;
  if (status !== "avvik") return null;
  if (typeof sum !== "number" || typeof total !== "number") return null;
  if (!Number.isFinite(sum) || !Number.isFinite(total)) return null;
  const differanse = rund(total - sum);
  if (differanse <= SLINGRING) return null;
  return { sum, total, differanse };
}
