// Hovedstol-konsistens på tvers av en saks brev (§0 —
// MEDHOLD_HOVEDSTOL_KONSISTENS_ARBEIDSORDRE). Ren, deterministisk kode —
// «AI tolker (leser hovedstolen ut av hvert brev), kode observerer avvik».
// Ingen dom om årsak (feillesning vs. reell endring) — kun observasjonen.

export type HovedstolAvvik = {
  brevId: string;
  brevdato: string | null;
  hovedstol: number;
  forrigeHovedstol: number;
  forrigeBrevId: string;
};

/** Kun feltene sammenligningen trenger. `opprettet` er IKKE med i
 *  arbeidsordrens skisserte signatur, men kreves av dens egen sorteringsregel
 *  («fall tilbake til opprettet-tidsstempel») — lagt til her, se
 *  PROSJEKT_STATUS «Valg tatt underveis». */
export type HovedstolBrevInput = {
  id: string;
  brevdato: string | null;
  belop_hovedstol: number | null;
  opprettet: string;
};

/** Kronologisk: brevdato først (eldst→nyest), datert før udatert, og
 *  opprettet-tidsstempel som fallback ved lik/manglende dato. */
function sorterKronologisk(brev: HovedstolBrevInput[]): HovedstolBrevInput[] {
  return [...brev].sort((a, b) => {
    if (a.brevdato && b.brevdato) {
      if (a.brevdato !== b.brevdato) return a.brevdato < b.brevdato ? -1 : 1;
      return a.opprettet < b.opprettet ? -1 : a.opprettet > b.opprettet ? 1 : 0;
    }
    if (a.brevdato && !b.brevdato) return -1;
    if (!a.brevdato && b.brevdato) return 1;
    return a.opprettet < b.opprettet ? -1 : a.opprettet > b.opprettet ? 1 : 0;
  });
}

/**
 * Sammenligner belop_hovedstol på tvers av en saks brev, sortert
 * kronologisk. Returnerer ett avvik per sted hovedstolen endrer seg mellom
 * to påfølgende brev — sammenligner alltid mot NÆRMESTE forrige brev som
 * faktisk har en oppgitt hovedstol (brev uten hovedstol filtreres bort før
 * sammenligningen, så de aldri inngår som forrige/nåværende). Under 2 brev
 * med hovedstol → tom liste. Eksakt likhet (ingen øre-toleranse).
 */
export function finnHovedstolAvvik(
  brev: HovedstolBrevInput[],
): HovedstolAvvik[] {
  const sortert = sorterKronologisk(brev).filter(
    (b): b is HovedstolBrevInput & { belop_hovedstol: number } =>
      b.belop_hovedstol != null,
  );

  const avvik: HovedstolAvvik[] = [];
  for (let i = 1; i < sortert.length; i++) {
    const forrige = sortert[i - 1];
    const naa = sortert[i];
    if (naa.belop_hovedstol !== forrige.belop_hovedstol) {
      avvik.push({
        brevId: naa.id,
        brevdato: naa.brevdato,
        hovedstol: naa.belop_hovedstol,
        forrigeHovedstol: forrige.belop_hovedstol,
        forrigeBrevId: forrige.id,
      });
    }
  }
  return avvik;
}
