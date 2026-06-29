// Dato-hjelpere. Frister lagres som rene datoer (YYYY-MM-DD).

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

/** Antall hele dager fra i dag til datoen (negativt = på overtid). */
export function dagerTil(isoDato: string): number {
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);
  const mål = new Date(isoDato + "T00:00:00");
  const msPerDag = 1000 * 60 * 60 * 24;
  return Math.round((mål.getTime() - idag.getTime()) / msPerDag);
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
