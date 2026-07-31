// Delt tekstsøk-utility (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §B.2). Ren
// tekstbehandling, ingen tolkning, ingen AI — flyttet ut av utkast-stemme.ts
// (som fant forbudte ord/fraser i genererte utkast) slik at alvorsgrense.ts
// kan gjenbruke samme ordgrense- og æøå-bevisste søk, uten duplisert regex.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bygger en ordgrense-bevisst regex for en (evt. flerords) frase. Bruker
 * Unicode-bokstavklasser i grensene, slik at norske bokstaver (æøå) telles
 * som ordtegn — ellers ville «\b» kunne gi falske treff/ikke-treff rundt dem. */
export function fraseRegex(frase: string): RegExp {
  const mønster = escapeRegex(frase).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${mønster}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Returnerer hvilke av `fraser` som finnes i `tekst` (case-insensitivt,
 * ordgrense-bevisst — «beroende» gir f.eks. ikke falskt treff på «i bero»).
 * Rent tekstsøk, ingen fuzzy matching.
 */
export function finnFraser(tekst: string, fraser: string[]): string[] {
  return fraser.filter((frase) => fraseRegex(frase).test(tekst));
}
