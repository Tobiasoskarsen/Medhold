// Dato-hjelpere. Frister lagres som rene datoer (YYYY-MM-DD).
//
// VIKTIG: bruk ALDRI `new Date()` alene for å avgjøre «i dag» — serveren
// (Vercel) kjører i UTC, og Norge ligger foran UTC (CEST = UTC+2 om sommeren),
// så uten eksplisitt tidssone viser serveren «i går» store deler av kvelden.
// `idagOslo()` er eneste kilde til «i dag» i appen.

/** Dagens dato i norsk tid (Europe/Oslo) som YYYY-MM-DD (en-CA gir ISO-format). */
export function idagOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formaterDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formaterKortDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

/** Antall hele dager fra i dag (norsk tid) til datoen (negativt = på overtid). */
export function dagerTil(isoDato: string): number {
  const idag = Date.parse(`${idagOslo()}T00:00:00Z`);
  const mål = Date.parse(`${isoDato}T00:00:00Z`);
  const msPerDag = 1000 * 60 * 60 * 24;
  return Math.round((mål - idag) / msPerDag);
}

export type Hastegrad = "overtid" | "snart" | "senere";

export function hastegrad(isoDato: string): Hastegrad {
  const d = dagerTil(isoDato);
  if (d < 0) return "overtid";
  if (d <= 3) return "snart";
  return "senere";
}

/** Menneskelig tekst for hvor lang tid det er til fristen. */
export function fristNærhet(isoDato: string): string {
  const d = dagerTil(isoDato);
  if (d < -1) return `${Math.abs(d)} dager på overtid`;
  if (d === -1) return "1 dag på overtid";
  if (d === 0) return "I dag";
  if (d === 1) return "I morgen";
  return `Om ${d} dager`;
}

export const HASTEGRAD_STIL: Record<Hastegrad, string> = {
  overtid: "bg-red-50 text-red-700 ring-red-200",
  snart: "bg-amber-50 text-amber-700 ring-amber-200",
  senere: "bg-slate-100 text-slate-600 ring-slate-200",
};
