/** Lagret dokumentkobling er autoritativ. Aldri fall tilbake ved manglende dokument. */
export function velgUtkastbrev<T extends { id: string }>(brev: T[], lagret: { brev_id: string | null } | undefined, parameter: string | undefined): { brev: T | null; utilgjengelig: boolean } {
  const id = lagret ? lagret.brev_id : parameter;
  if (lagret && !id) return { brev: null, utilgjengelig: true };
  if (id) {
    const funnet = brev.find(b => b.id === id) ?? null;
    return { brev: funnet, utilgjengelig: !funnet };
  }
  return { brev: brev[0] ?? null, utilgjengelig: false };
}
