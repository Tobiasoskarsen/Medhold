// Avdragshjelper for «Kravet stemmer»-sporet. Ren, deterministisk kode —
// «AI tolker, kode beslutter». Regner ut en nedbetalingsplan fra et månedsbeløp
// brukeren selv oppgir. Ingen råd om hva man BØR betale — bare matematikken.

export type AvdragsForslag = {
  manedsbelop: number; // kr, heltall
  antallMandeder: number; // rundet opp
  sisteAvdrag: number; // restbeløp siste måned
};

/**
 * Nedbetalingsplan for `total` med `manedsbelop` per måned. `manedsbelop`
 * valideres: minst 1 kr, maks hele totalbeløpet (én måned). Beløp behandles
 * som hele kroner.
 */
export function beregnAvdrag(
  total: number,
  manedsbelop: number,
): AvdragsForslag {
  const t = Math.max(0, Math.round(total));
  if (t === 0) return { manedsbelop: 0, antallMandeder: 0, sisteAvdrag: 0 };

  let m = Math.round(manedsbelop);
  if (m < 1) m = 1;
  if (m > t) m = t; // maks = hele beløpet på én måned

  const antallMandeder = Math.ceil(t / m);
  const sisteAvdrag = t - (antallMandeder - 1) * m;
  return { manedsbelop: m, antallMandeder, sisteAvdrag };
}
