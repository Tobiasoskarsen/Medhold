// Små formateringshjelpere for visning.

/** Beløp med norsk tusenskille, uten øre og uten «kr». Null → null. */
export function formaterBelop(
  kroner: number | null | undefined,
): string | null {
  if (kroner == null) return null;
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(
    kroner,
  );
}
