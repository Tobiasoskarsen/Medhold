// Kreditor-tinter (R8): den runde initial-sirkelen får én av fire tinter, regnet
// ut fra kreditornavnet. Samme navn gir alltid samme tint, så sirkelen ikke
// «hopper» mellom Hjem, Saker og saken. Fargene er tokenene --tint-N-bg/-tekst.

export type Tint = 1 | 2 | 3 | 4;

/** Stabil hash (FNV-1a) av navnet uten forskjell på store/små bokstaver og mellomrom. */
export function tintFor(navn: string): Tint {
  const n = navn.trim().toLowerCase().replace(/\s+/g, " ");
  let h = 0x811c9dc5;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h % 4) + 1) as Tint;
}

/** Tailwind-klassene for en tint. Hele strenger, så Tailwind finner dem. */
export const TINT_KLASSE: Record<Tint, string> = {
  1: "bg-tint-1-bg text-tint-1-tekst",
  2: "bg-tint-2-bg text-tint-2-tekst",
  3: "bg-tint-3-bg text-tint-3-tekst",
  4: "bg-tint-4-bg text-tint-4-tekst",
};

/**
 * Initialene i profilknappen: første bokstav i de to første ordene
 * («Tobias Oskarsen» → «TO»), ellers første bokstav. Faller tilbake til
 * e-postadressen når navnet mangler.
 */
export function initialerFra(navn: string | null | undefined, epost?: string | null): string {
  const ord = (navn ?? "").trim().split(/\s+/).filter(Boolean);
  if (ord.length >= 2) return (ord[0][0] + ord[1][0]).toLocaleUpperCase("nb-NO");
  if (ord.length === 1) return ord[0][0].toLocaleUpperCase("nb-NO");
  const e = (epost ?? "").trim();
  return e ? e[0].toLocaleUpperCase("nb-NO") : "M";
}
