// Sentral AI-konfigurasjon. Modellnavn bor kun her, slik at en
// modelloppgradering er én linje å endre (ikke spredte strenger).
// AI_MODELL: skrivekvalitet, tone, few-shot (utkastgenerering, brev-samtale).
// AI_MODELL_RASK: strukturert felt-uttrekk, kort omskriving (se
// MEDHOLD_AI_FART_ARBEIDSORDRE §A for hvilket kall bruker hvilken).
export const AI_MODELL = "claude-sonnet-5";
// «claude-haiku-4-5» i arbeidsordren var en forkortet streng — den eksakte,
// gjeldende modell-ID-en (verifisert, per arbeidsordrens eget forbehold i
// §A.1) har en datostempel-suffiks.
export const AI_MODELL_RASK = "claude-haiku-4-5-20251001";

/**
 * Kontrollsekvenser i utkast-strømmen (api/utkast-generer/route.ts),
 * adskilt fra selve brevteksten med et NUL-tegn på hver side — AI-generert
 * brevtekst inneholder aldri NUL, så disse kan aldri forveksles med innhold.
 * Delt konstant (ikke duplisert streng server/klient, se UtkastFlyt.tsx) —
 * server og klient MÅ være enige om eksakt samme verdi.
 *
 * NUL-tegnet bygges eksplisitt via fromCharCode i stedet for å skrives
 * direkte i kildefilen som et usynlig tegn — en rå NUL-byte i selve
 * kildefilen viste seg å ødelegge Turbopacks klient-bundling (SyntaxError i
 * nettleseren) selv om den er gyldig for tsc/Node.
 */
const NUL = String.fromCharCode(0);

export const UTKAST_STRØM_MARKØR = {
  FERDIG: `${NUL}__FERDIG__${NUL}`,
  JUSTERER: `${NUL}__JUSTERER__${NUL}`,
  FEIL: `${NUL}__FEIL__${NUL}`,
} as const;
