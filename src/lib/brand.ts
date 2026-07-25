// Enkelt merkevarenavn brukt overalt (metadata, e-poster, UI, manifest).
// Ingen hardkodede forekomster av det gamle navnet skal gjenstå.
export const APP_NAME = "Medhold";

// Vises i bunnteksten på Meg. Vedlikeholdes manuelt — bumpes ved merkbare
// lanseringer, ikke per commit.
export const APP_VERSJON = "1.0";

// E-post for support/hjelp. Byttes til en dedikert supportadresse senere.
export const SUPPORT_EPOST = "tobsenfire@gmail.com";

// Fast, kodebestemt linje under AI-forklaringen av et brev (analyse-kort-
// ordren §1.2) — disclaimeren er IKKE lenger en del av AI-teksten selv, slik
// at den er identisk og garantert til stede overalt forklaringen vises.
export const FORKLARING_DISCLAIMER =
  "Automatisk forklaring — ikke profesjonell rådgivning.";
