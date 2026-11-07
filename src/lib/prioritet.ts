// Hvilken sak og frist som er viktigst nå. Ren kode uten datoer fra klokka, så
// reglene kan testes. Brukes av Hjem, Saker, saksdetaljer og fristvarselet.
import { dagerMellom, erGammeltBrev } from "./frist.ts";
import type { SakStatus } from "./types";

/** En utløpt frist er historikk etter så mange dager, også på et nyere brev. */
export const UTLOPT_HISTORIKK_DAGER = 14;
/** Så få dager igjen går foran en frist som nylig har gått ut. */
export const SNART_DAGER = 2;

/** Det som trengs for å vurdere én frist. */
export type FristDato = {
  brev_id: string | null;
  forfallsdato: string;
};
export type FristInn = FristDato & { sak_id: string };
export type BrevInn = {
  id: string;
  sak_id: string;
  brevdato: string | null;
  opprettet: string;
  alvorlig?: boolean | null;
};
export type SakInn = {
  id: string;
  status: SakStatus;
  belop_totalt?: number | null;
};

export type FristKlasse = "snart" | "utlopt" | "senere" | "historikk";

const KLASSE_RANG: Record<FristKlasse, number> = {
  snart: 0,
  utlopt: 1,
  senere: 2,
  historikk: 3,
};

/** Nyeste brev per sak: brevdato først, brev uten dato sist, så opprettet. */
export function sisteBrevPerSak<B extends BrevInn>(brev: B[]): Map<string, B> {
  const ut = new Map<string, B>();
  for (const b of brev) {
    const n = ut.get(b.sak_id);
    if (!n || erNyere(b, n)) ut.set(b.sak_id, b);
  }
  return ut;
}

function erNyere(a: BrevInn, b: BrevInn): boolean {
  if (a.brevdato && !b.brevdato) return true;
  if (!a.brevdato && b.brevdato) return false;
  if (a.brevdato && b.brevdato && a.brevdato !== b.brevdato) return a.brevdato > b.brevdato;
  return a.opprettet > b.opprettet;
}

export function fristKlasse(f: FristDato, brev: BrevInn[], idag: string): FristKlasse {
  const dager = dagerMellom(idag, f.forfallsdato);
  if (dager < 0) {
    const egetBrev = f.brev_id ? brev.find((b) => b.id === f.brev_id) : undefined;
    const fraGammeltBrev =
      !!egetBrev && erGammeltBrev(egetBrev.brevdato, egetBrev.opprettet, idag);
    return fraGammeltBrev || dager < -UTLOPT_HISTORIKK_DAGER ? "historikk" : "utlopt";
  }
  return dager <= SNART_DAGER ? "snart" : "senere";
}

/**
 * Fristen som betyr mest av de oppgitte (aktive) fristene. Kommende frister tas
 * nærmeste først, utløpte nyeste først. Null når det ikke finnes noen.
 */
export function relevantFrist<F extends FristDato>(
  frister: F[],
  brev: BrevInn[],
  idag: string,
): { frist: F; klasse: FristKlasse } | null {
  let best: { frist: F; klasse: FristKlasse } | null = null;
  for (const frist of frister) {
    const klasse = fristKlasse(frist, brev, idag);
    if (!best || gaarForan(frist, klasse, best.frist, best.klasse)) best = { frist, klasse };
  }
  return best;
}

function gaarForan(a: FristDato, ka: FristKlasse, b: FristDato, kb: FristKlasse): boolean {
  if (ka !== kb) return KLASSE_RANG[ka] < KLASSE_RANG[kb];
  return ka === "utlopt" || ka === "historikk"
    ? a.forfallsdato > b.forfallsdato
    : a.forfallsdato < b.forfallsdato;
}

export type Grunn =
  | "alvorlig"
  | "frist_snart"
  | "frist_utlopt"
  | "frist_senere"
  | "aktiv"
  | "frist_historikk"
  | "venter";

const GRUNN_RANG: Record<Grunn, number> = {
  alvorlig: 0,
  frist_snart: 1,
  frist_utlopt: 2,
  frist_senere: 3,
  aktiv: 4,
  frist_historikk: 5,
  venter: 6,
};

export type RangertSak<S, F> = {
  sak: S;
  /** Sakens viktigste frist. Alltid null for en sak som venter på svar. */
  frist: F | null;
  klasse: FristKlasse | null;
  grunn: Grunn;
  /** Nyeste brev er alvorlig. Et brev over 45 dager gammelt gir ikke forrang. */
  alvorlig: boolean;
};

/**
 * Rangerer åpne saker, viktigst først. Avsluttede saker er ikke med.
 *
 * Frister teller bare på aktive saker: en sak som venter har fått svaret sitt
 * sendt. Et nytt brev med ny frist gjør saken aktiv (statusVedNyttBrev).
 * Gamle utløpte frister kommer etter saker uten frist, men foran saker som venter,
 * siden brukeren der kan ha et nyere brev å legge til.
 */
export function rangerSaker<S extends SakInn, F extends FristInn>(
  saker: S[],
  frister: F[],
  brev: BrevInn[],
  idag: string,
): RangertSak<S, F>[] {
  const siste = sisteBrevPerSak(brev);
  const rader = saker
    .filter((s) => s.status !== "fullfort")
    .map((sak, plass) => {
      const egne = sak.status === "aktiv" ? frister.filter((f) => f.sak_id === sak.id) : [];
      const valgt = relevantFrist(egne, brev, idag);
      const b = siste.get(sak.id);
      const alvorlig =
        !!b?.alvorlig && !erGammeltBrev(b.brevdato, b.opprettet, idag);
      const grunn: Grunn = alvorlig
        ? "alvorlig"
        : sak.status === "venter_pa_svar"
          ? "venter"
          : !valgt
            ? "aktiv"
            : valgt.klasse === "snart"
              ? "frist_snart"
              : valgt.klasse === "utlopt"
                ? "frist_utlopt"
                : valgt.klasse === "senere"
                  ? "frist_senere"
                  : "frist_historikk";
      return {
        plass,
        rad: {
          sak,
          frist: valgt?.frist ?? null,
          klasse: valgt?.klasse ?? null,
          grunn,
          alvorlig,
        } as RangertSak<S, F>,
      };
    });

  rader.sort((a, b) => {
    const g = GRUNN_RANG[a.rad.grunn] - GRUNN_RANG[b.rad.grunn];
    if (g !== 0) return g;
    if (a.rad.frist && b.rad.frist && a.rad.frist.forfallsdato !== b.rad.frist.forfallsdato) {
      const tidligere = a.rad.frist.forfallsdato < b.rad.frist.forfallsdato ? -1 : 1;
      return a.rad.klasse === "utlopt" || a.rad.klasse === "historikk" ? -tidligere : tidligere;
    }
    const belop = (b.rad.sak.belop_totalt ?? 0) - (a.rad.sak.belop_totalt ?? 0);
    return belop !== 0 && a.rad.frist && b.rad.frist ? belop : a.plass - b.plass;
  });
  return rader.map((r) => r.rad);
}

/** Viktigste åpne sak, eller null når ingen saker er åpne. */
export function velgViktigsteSak<S extends SakInn, F extends FristInn>(
  saker: S[],
  frister: F[],
  brev: BrevInn[],
  idag: string,
): RangertSak<S, F> | null {
  return rangerSaker(saker, frister, brev, idag)[0] ?? null;
}

/**
 * Om Medhold-kortet kan vises på Hjem. Bare når ingen åpne saker finnes: en
 * gratulasjon skal aldri ta plassen til noe som krever oppmerksomhet.
 */
export function kanViseSeier(
  saker: { status: SakStatus; utfall?: string | null }[],
): boolean {
  return (
    saker.length > 0 &&
    saker.every((s) => s.status === "fullfort") &&
    saker[0].utfall === "medhold"
  );
}

/**
 * Om en frist skal utløse et varsel. Bare aktive frister, og ikke på avsluttede
 * saker. Fullførte og erstattede frister har fullfort = true.
 * En sak som venter får fortsatt varsel: fristen løper også da.
 */
export function skalVarsles(f: {
  fullfort?: boolean | null;
  sakStatus: SakStatus | null;
}): boolean {
  return !f.fullfort && f.sakStatus !== null && f.sakStatus !== "fullfort";
}
