// Ligger brevet i saken fra før? (Del C.4.) Bare en advarsel, aldri en sperre:
// brukeren kan alltid legge inn brevet likevel.
// Relative importer med .ts-endelse, så filen også kan kjøres direkte av Node.

export type BrevNokkel = {
  brevdato: string | null;
  belop: number | null;
  /** Brevet har ikke eget saksnummer; for et lagret brev brukes sakens. */
  saksnummer: string | null;
};

function normaliserNr(nr: string | null): string {
  return (nr ?? "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Samme brev: samme brevdato og samme beløp (±0,01 kr). Har begge et
 * saksnummer, må det også være likt. Mangler dato eller beløp, gjettes det
 * ikke: da er det ikke et treff.
 */
export function erLiktBrev(a: BrevNokkel, b: BrevNokkel): boolean {
  if (!a.brevdato || !b.brevdato || a.brevdato !== b.brevdato) return false;
  if (a.belop === null || b.belop === null || Math.abs(a.belop - b.belop) > 0.01 + 1e-9) return false;
  const nrA = normaliserNr(a.saksnummer);
  const nrB = normaliserNr(b.saksnummer);
  if (nrA && nrB && nrA !== nrB) return false;
  return true;
}
