// Ren logikk for «hjelp meg å velge»-sjekklisten (MEDHOLD_VEIVALG_ARBEIDSORDRE).
// Ingen AI, ingen lagring — svarene er flyktige og lever kun i komponenten.

export type VeivalgSvar = {
  bestilt: "ja" | "nei" | "vet_ikke"; // Har du bestilt/avtalt det kravet gjelder?
  tidligereHandlet: "ja" | "nei"; // Sagt opp, betalt, eller klaget tidligere?
  belopStemmer: "ja" | "nei" | "vet_ikke"; // Stemmer beløpet?
};

export type Anbefaling = "svar" | "betale";

/**
 * Tvil («vet ikke») peker mot å svare og be om dokumentasjon — aldri mot å
 * godta kravet. «betale» krever derfor at alle tre svarene aktivt
 * bekrefter at kravet stemmer; ett usikkert eller negativt svar er nok
 * til å anbefale «svar».
 */
export function anbefalVei(s: VeivalgSvar): Anbefaling {
  if (
    s.bestilt !== "ja" ||
    s.tidligereHandlet === "ja" ||
    s.belopStemmer !== "ja"
  ) {
    return "svar";
  }
  return "betale";
}
