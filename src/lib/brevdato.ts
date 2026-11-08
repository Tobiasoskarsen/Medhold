// Når skal et nytt brev endre sakens beløp, stadium og saksnummer? Bare når det
// er nyere enn alt saken allerede har. Regelen håndheves i databasen
// (brev_datovurdering, migrasjon 0029); her er samme regel for forhåndsvisning.
// supabase/tests/lagring-0029.test.mjs sjekker at de gir likt svar.
//
// Brevdatoen er datoen som står på brevet. Den fylles aldri inn med dagens dato
// eller opplastingstidspunktet: mangler den, er den tom.

export type Datovurdering = "nyest" | "eldre" | "lik" | "mangler";

/**
 * @param nyDato        brevdatoen på brevet som lagres (ISO), eller null
 * @param sakensBrevdatoer brevdatoene til brevene saken allerede har (null = udatert).
 *   Udaterte brev teller ikke: med denne regelen endrer de aldri saken selv.
 */
export function vurderBrevdato(
  nyDato: string | null,
  sakensBrevdatoer: (string | null)[],
): Datovurdering {
  if (!nyDato) return "mangler";
  const siste = sakensBrevdatoer.reduce<string | null>((m, d) => (d && (!m || d > m) ? d : m), null);
  if (!siste) return "nyest";
  if (nyDato > siste) return "nyest";
  if (nyDato === siste) return "lik";
  return "eldre";
}

/** Forklaring til brukeren når brevet ikke automatisk oppdaterer saken. */
export function datovurderingTekst(v: Datovurdering): string | null {
  switch (v) {
    case "nyest":
      return null;
    case "eldre":
      return "Dette brevet er eldre enn det nyeste brevet i saken. Det lagres i historikken, men endrer ikke beløpet eller stadiet saken har nå.";
    case "lik":
      return "Saken har allerede et brev med samme dato. Vi vet ikke hvilket som er nyest, så beløpet og stadiet endres ikke automatisk.";
    case "mangler":
      return "Brevet har ingen dato. Vi gjetter ikke, så beløpet og stadiet på saken endres ikke automatisk.";
  }
}
