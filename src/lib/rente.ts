// Forsinkelsesrente (Del B): høyeste lovlige rente for en periode, beregnet
// deterministisk av hovedstol, datoer og Finanstilsynets satser. «AI tolker,
// kode beslutter»: AI-en leser bare datoer og sats slik de står i brevet.
//
// Satsene er hentet fra Finanstilsynet, «Forsinkelsesrente», og verifisert
// 2026-11-11. Tabellen dekker 2020-01-01 til og med 2026-12-31. Fra 2027-01-01
// gir renter «ukjent» til en ny periode er lagt inn (se «Årlig satsoppdatering»
// i PROSJEKT_STATUS.md). Samme regel som satserForDato: aldri nærmeste eller
// nyeste sats som erstatning for en periode vi ikke har.
//
// Relative importer med .ts-endelse, så filen også kan kjøres direkte av Node.

const KILDE =
  "https://www.finanstilsynet.no/analyser-og-statistikk/forsinkelsesrente-og-standardkompensasjon/forsinkelsesrente/";

export type Renteperiode = { fra: string; til: string; sats: number; kilde: string };

const periode = (fra: string, til: string, sats: number): Renteperiode => ({ fra, til, sats, kilde: KILDE });

/** Forsinkelsesrente i % p.a., eldst først. Hver periode er et halvår. */
export const RENTEPERIODER: Renteperiode[] = [
  periode("2020-01-01", "2020-06-30", 9.5),
  periode("2020-07-01", "2020-12-31", 8.0),
  periode("2021-01-01", "2021-06-30", 8.0),
  periode("2021-07-01", "2021-12-31", 8.0),
  periode("2022-01-01", "2022-06-30", 8.5),
  periode("2022-07-01", "2022-12-31", 9.25),
  periode("2023-01-01", "2023-06-30", 10.75),
  periode("2023-07-01", "2023-12-31", 11.75),
  periode("2024-01-01", "2024-06-30", 12.5),
  periode("2024-07-01", "2024-12-31", 12.5),
  periode("2025-01-01", "2025-06-30", 12.5),
  periode("2025-07-01", "2025-12-31", 12.25),
  periode("2026-01-01", "2026-06-30", 12.0),
  periode("2026-07-01", "2026-12-31", 12.25),
];

/** Én del av en rentebeløpsberegning: en delperiode med én sats. */
export type Rentesegment = {
  fra: string;
  til: string;
  sats: number;
  /** Antall dager, begge ender inkludert (øvre grense). */
  dager: number;
  /** 365, eller 366 i skuddår. */
  arsdager: number;
  /** hovedstol × sats × dager / årsdager, urundet. */
  belop: number;
};

const DAG_MS = 86_400_000;

/** Gyldig kalenderdato på formen ÅÅÅÅ-MM-DD. */
export function erIsoDato(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const tid = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const dagEtter = (iso: string) => new Date(tid(iso) + DAG_MS).toISOString().slice(0, 10);
const erSkuddar = (ar: number) => (ar % 4 === 0 && ar % 100 !== 0) || ar % 400 === 0;
/** Antall dager mellom to datoer, begge ender inkludert. */
const dagerInkl = (fra: string, til: string) => Math.round((tid(til) - tid(fra)) / DAG_MS) + 1;

/**
 * Delperiodene av [fra, til] med hver sin sats, eller null når datoene er
 * ugyldige, fra er etter til, eller tabellen ikke dekker hele perioden.
 */
function delperioder(fra: string, til: string): { fra: string; til: string; sats: number }[] | null {
  if (!erIsoDato(fra) || !erIsoDato(til) || fra > til) return null;
  const ut: { fra: string; til: string; sats: number }[] = [];
  let markor = fra;
  while (markor <= til) {
    const p = RENTEPERIODER.find((x) => x.fra <= markor && markor <= x.til);
    if (!p) return null;
    const slutt = p.til < til ? p.til : til;
    ut.push({ fra: markor, til: slutt, sats: p.sats });
    markor = dagEtter(slutt);
  }
  return ut;
}

/** Utregningen per delperiode, eller null når perioden ikke er helt dekket. */
export function renteSegmenter(hovedstol: number, fra: string, til: string): Rentesegment[] | null {
  if (!Number.isFinite(hovedstol) || hovedstol < 0) return null;
  const deler = delperioder(fra, til);
  if (!deler) return null;
  return deler.map((d) => {
    const dager = dagerInkl(d.fra, d.til);
    // En delperiode ligger alltid innenfor ett kalenderår (halvårsperioder).
    const arsdager = erSkuddar(Number(d.fra.slice(0, 4))) ? 366 : 365;
    return { ...d, dager, arsdager, belop: (hovedstol * d.sats * dager) / (100 * arsdager) };
  });
}

/**
 * Høyeste forventede rente for hovedstolen i [fra, til], begge ender
 * inkludert, delt per halvår og rundet til to desimaler. Null når perioden
 * ikke er helt dekket av tabellen («perioden er ikke lagt inn», ikke «ukjent sats»).
 */
export function forventetRente(hovedstol: number, fra: string, til: string): number | null {
  const segmenter = renteSegmenter(hovedstol, fra, til);
  if (!segmenter) return null;
  const sum = segmenter.reduce((s, x) => s + x.belop, 0);
  return Math.round(sum * 100) / 100;
}

/** Høyeste lovlige sats som gjaldt noen dag i [fra, til]. Null når perioden ikke er dekket. */
export function hoyesteSats(fra: string, til: string): number | null {
  const deler = delperioder(fra, til);
  return deler ? Math.max(...deler.map((d) => d.sats)) : null;
}

/** «12,25», «12.25 %» → 12.25. Ugyldig, negativ eller over 40 → null. */
export function tolkSats(x: unknown): number | null {
  const tekst = typeof x === "number" ? String(x) : typeof x === "string" ? x : "";
  const rent = tekst.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(rent)) return null;
  const n = Number(rent);
  return n >= 0 && n <= 40 ? n : null;
}

/** Feltene en rentelinje kan ha utover type, beløp og tekst. */
export type Rentefelt = { renteFra?: string; renteTil?: string; rentesats?: number };

/**
 * Renser rentefeltene på en kostnadslinje: ugyldig dato fjernes, sats utenfor
 * 0–40 fjernes, og andre linjetyper mister feltene helt. Brukes både på det AI
 * leser og på det klienten sender, så ingenting ugyldig lagres.
 */
export function normaliserRentefelt<T extends { type: string } & Rentefelt>(linje: T): T {
  const { renteFra, renteTil, rentesats, ...rest } = linje;
  if (linje.type !== "forsinkelsesrente") return rest as unknown as T;
  const ut: Rentefelt = {};
  if (erIsoDato(renteFra)) ut.renteFra = renteFra;
  if (erIsoDato(renteTil)) ut.renteTil = renteTil;
  const sats = tolkSats(rentesats);
  if (sats !== null) ut.rentesats = sats;
  return { ...rest, ...ut } as unknown as T;
}
