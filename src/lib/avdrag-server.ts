import { beregnAvdrag, type AvdragsForslag } from "./avdrag.ts";

function pengeOre(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  const ore = Math.round(v * 100);
  return Number.isSafeInteger(ore) && ore > 0 && Math.abs(v * 100 - ore) < 0.0001 ? ore : null;
}
/** Totalen kommer fra serverens sak. Ingen fremtidige renter/kostnader utledes. */
export function kontrollerAvdragsforslag(total: unknown, input: unknown): { ok: true; avdrag: AvdragsForslag | null } | { ok: false; feil: string } {
  if (input == null) return { ok: true, avdrag: null };
  const feil = { ok: false, feil: "Betalingsforslaget stemmer ikke med kravbeløpet. Åpne betalingsalternativene og beregn det på nytt." } as const;
  if (typeof input !== "object" || Array.isArray(input)) return feil;
  const a = input as Record<string, unknown>;
  const t = pengeOre(total), m = pengeOre(a.manedsbelop), siste = pengeOre(a.sisteAvdrag);
  if (t === null || m === null || siste === null || !Number.isInteger(a.antallMandeder) || Number(a.antallMandeder) < 1) return feil;
  const plan = beregnAvdrag(t / 100, m / 100);
  if (plan.antallMandeder !== a.antallMandeder || Math.round(plan.sisteAvdrag * 100) !== siste ||
      Math.round(plan.manedsbelop * 100) !== m ||
      (plan.antallMandeder - 1) * m + siste !== t) return feil;
  return { ok: true, avdrag: plan };
}
