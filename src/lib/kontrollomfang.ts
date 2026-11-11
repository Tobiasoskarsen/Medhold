import { FRIST_HJEMMEL } from "./gjeld.ts";

export function fristKontrollStottes(type: string | null): boolean {
  return !!type && Object.hasOwn(FRIST_HJEMMEL, type) && !!FRIST_HJEMMEL[type as keyof typeof FRIST_HJEMMEL];
}

// «Hva er kontrollert?» i vanlig språk (Del F.3). Ordrett fra arbeidsordren.
export const GEBYR_OMFANG = "Vi sjekker hvert gebyr mot maksimalsatsen i inkassoforskriften. Vi sjekker ikke om kreditor har lov til å kreve alle gebyrene samtidig, og vi sjekker ikke renter ennå.";
export const FRIST_OMFANG = "Vi sjekker fristen i purringer, inkassovarsler og betalingsoppfordringer når brevet har dato. Fristen sier ikke om kravet er riktig.";
export const VARSEL_OMFANG = "Vi varsler om noen alvorlige tegn, som forliksråd og namsmann. Får du ikke varsel, betyr ikke det at alt er i orden.";
export const FRIST_IKKE_KONTROLLERT = "Medhold har ikke kontrollert den juridiske fristen for denne brevtypen.";
