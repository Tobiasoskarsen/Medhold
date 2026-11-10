import { formaterDato } from "./dato.ts";
import { kr } from "./gebyrfunn-visning.ts";

/** Bare felt fra dokumentlesing/brukerretting. Ingen utledet historikk eller
 * juridiske konsekvenser. Gebyr- og fristvurdering har egne kildebaserte paneler. */
export function brevforklaring(f: { avsender: string; brevtype: string | null; brevdato: string; belop: number | null; saksnummer: string }): string {
  const type = f.brevtype === "forliksrad" ? "forliksråd" : f.brevtype || "ukjent";
  return [
    `Opplysninger fra brevet: Avsender er ${f.avsender.trim() || "ukjent"}. Registrert brevtype er ${type}.`,
    `Oppgitt totalbeløp: ${f.belop === null ? "ukjent" : `${kr(f.belop)} kr`}. Brevdato: ${f.brevdato ? formaterDato(f.brevdato) : "ukjent"}. Saksnummer: ${f.saksnummer.trim() || "ukjent"}.`,
    "Kontroller opplysningene mot brevet. Denne oppsummeringen bekrefter ikke at kravet er riktig. Støttede gebyrer og frister vurderes separat; tidligere hendelser og fremtidig rettslig prosess er ikke fastslått her.",
  ].join("\n\n");
}
