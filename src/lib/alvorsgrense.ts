// Alvorsgrense (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §B.3). Medhold er bygget
// for vanlige inkassosaker — ikke for saker på randen av konkurs/tvangssalg.
// Rent tekstsøk på brevets EGEN tekst, ingen AI-dom, ingen tolkning av
// kontekst. Bevisst lav terskel (ett treff er nok): falske positiver er
// ufarlige her (verste konsekvens er en unødvendig henvisning til gratis
// hjelp), falske negativer er det som må unngås.
import { finnFraser } from "./tekstsok.ts";

export const ALVORLIGE_SIGNALER: string[] = [
  "konkursbegjæring",
  "konkursloven",
  "begjære konkurs",
  "begjæring om konkurs",
  "tvangssalg",
  "tvangsdekning",
  "tvangsauksjon",
  "tvangsfravikelse",
];

/** Ett treff er nok — se guardrail-notatet over. */
export function erAlvorligSak(brevtekst: string): boolean {
  return finnFraser(brevtekst, ALVORLIGE_SIGNALER).length > 0;
}
