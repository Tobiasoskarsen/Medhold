// Avdragshjelper for «Finn en måte å betale på»-sporet. Ren, deterministisk kode —
// «AI tolker, kode beslutter». Regner ut en nedbetalingsplan fra et månedsbeløp
// brukeren selv oppgir. Ingen råd om hva man BØR betale — bare matematikken.

export type AvdragsForslag = {
  manedsbelop: number; // kr, inntil to desimaler
  antallMandeder: number; // rundet opp
  sisteAvdrag: number; // restbeløp siste måned
};

/**
 * Nedbetalingsplan for `total` med `manedsbelop` per måned. `manedsbelop`
 * valideres: minst 1 kr, maks hele totalbeløpet (én måned). Beløp behandles
 * som heltallsøre; avrunding skjer først ved inputgrensen.
 */
export function beregnAvdrag(
  total: number,
  manedsbelop: number,
): AvdragsForslag {
  const t = Number.isFinite(total) ? Math.max(0, Math.round(total * 100)) : 0;
  if (t === 0) return { manedsbelop: 0, antallMandeder: 0, sisteAvdrag: 0 };

  let m = Number.isFinite(manedsbelop) ? Math.round(manedsbelop * 100) : 100;
  if (m < 100) m = 100;
  if (m > t) m = t; // maks = hele beløpet på én måned

  const antallMandeder = Math.ceil(t / m);
  const sisteAvdrag = t - (antallMandeder - 1) * m;
  return { manedsbelop: m / 100, antallMandeder, sisteAvdrag: sisteAvdrag / 100 };
}
