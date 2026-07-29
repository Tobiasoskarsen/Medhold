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

// Grensen cron-en følger opp etter, og «Vi purrer om N dager»-visningene
// teller ned mot (MEDHOLD_SUBSTANS_ARBEIDSORDRE §5) — ÉN konstant, ikke
// duplisert. Endres denne, endres begge stedene med den.
export const OPPFOLGING_DAGER_GRENSE = 14;

/**
 * Saker som er modne for oppfølging: minst `dager` siden siste aktivitet, og
 * ikke allerede fulgt opp (`alleredeSendt` = sett med sak-id-er).
 */
export function oppfolgingsKandidater(
  saker: VenterSak[],
  alleredeSendt: Set<string>,
  naa: Date,
  dager = OPPFOLGING_DAGER_GRENSE,
): VenterSak[] {
  const grense = naa.getTime() - dager * 86_400_000;
  return saker.filter(
    (s) =>
      !alleredeSendt.has(s.sakId) && Date.parse(s.sisteAktivitet) <= grense,
  );
}

/**
 * Antall dager til Medhold følger opp en sak i «venter på svar» — negativt
 * når grensen allerede er passert (overskredet). `dagerSiden` telles i hele,
 * PASSERTE døgn (samme grense-logikk som `oppfolgingsKandidater`: cron-en
 * regner saken som moden idet 14 hele døgn er passert), bare uttrykt som en
 * nedtelling i stedet for et ja/nei-filter.
 */
export function dagerTilOppfolging(sisteAktivitet: string, naa: Date): number {
  const dagerSiden = Math.floor(
    (naa.getTime() - Date.parse(sisteAktivitet)) / 86_400_000,
  );
  return OPPFOLGING_DAGER_GRENSE - dagerSiden;
}

/**
 * Hvilken av de fire ventetid-tilstandene (§5) en sak i «venter på svar» er
 * i, gitt nedtellingen fra `dagerTilOppfolging`. Ren gren-logikk — selve
 * teksten (norsk, av/på-varianten) settes av kalleren (Hjem/krav-detalj),
 * som kjenner konteksten (kortform/langform, inkassoselskapets navn).
 */
export type OppfolgingTilstand =
  | { type: "kommer"; dager: number }
  | { type: "i_dag" }
  | { type: "sendt" }
  | { type: "na" };

export function oppfolgingTilstand(
  dagerTil: number,
  oppfolgingRegistrert: boolean,
): OppfolgingTilstand {
  if (dagerTil >= 1) return { type: "kommer", dager: dagerTil };
  if (dagerTil === 0) return { type: "i_dag" };
  return oppfolgingRegistrert ? { type: "sendt" } : { type: "na" };
}
