// Ren utvelgelse av oppfølgings-kandidater (Fase B). Ingen sideeffekter — testes
// isolert. En sak i «venter på svar» følges opp når det er lenge siden siste
// aktivitet OG den ikke er fulgt opp før.

export type VenterSak = {
  sakId: string;
  brukerId: string;
  kreditor: string | null;
  /** Nyeste av (utkast.sendt_at, nyeste brev.opprettet) — ISO-tidsstempel. */
  sisteAktivitet: string;
};

/**
 * Saker som er modne for oppfølging: minst `dager` siden siste aktivitet, og
 * ikke allerede fulgt opp (`alleredeSendt` = sett med sak-id-er).
 */
export function oppfolgingsKandidater(
  saker: VenterSak[],
  alleredeSendt: Set<string>,
  naa: Date,
  dager = 14,
): VenterSak[] {
  const grense = naa.getTime() - dager * 86_400_000;
  return saker.filter(
    (s) =>
      !alleredeSendt.has(s.sakId) && Date.parse(s.sisteAktivitet) <= grense,
  );
}
