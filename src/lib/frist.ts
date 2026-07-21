// Delt nedtellingslogikk (terskel + tekst) for Nedtelling og kravlistens
// nedtellingschip — samme regel begge steder (Sakslisteordre §2.2).
import { dagerTil } from "./dato";

/** ≤10 dager igjen (eller passert/i dag) → hastende, ellers nøytral. */
export function erHastende(dagerIgjen: number): boolean {
  return dagerIgjen <= 10;
}

/** «8 dager igjen» / «1 dag igjen» / «I dag» / «Frist utløpt». */
export function fristChipTekst(dagerIgjen: number): string {
  if (dagerIgjen < 0) return "Frist utløpt";
  if (dagerIgjen === 0) return "I dag";
  return dagerIgjen === 1 ? "1 dag igjen" : `${dagerIgjen} dager igjen`;
}

export { dagerTil };
