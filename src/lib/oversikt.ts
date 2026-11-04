// Oversikt-motoren for Hjem (MEDHOLD_SUBSTANS_ARBEIDSORDRE §1). Ren summering
// av data appen allerede har lagret — ingen nye AI-kall, ingen rekalkulering
// av gebyrsjekk (det lagrede LinjeResultat er sannheten, jf. gebyrsjekk-ordren).

import type { SakStatus, SakUtfall } from "./types";
import type { GebyrsjekkResultat } from "./gebyr";

export type HjemIngressInput = {
  /** Totalt antall saker (aktive + avsluttede). */
  antallSaker: number;
  /** Saker som ikke er fullført. */
  antallAktive: number;
  /** Åpne frister på aktive saker som allerede er passert. */
  antallUtlopteFrister: number;
  /** Av de utløpte: hvor mange som kommer fra et brev over 45 dager gammelt
   *  (erGammeltBrev). De er historikk og utløser ikke regel 3
   *  (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2). */
  antallUtlopteFraGamleBrev: number;
  /** Aktive saker med minst én åpen frist innen 0–7 dager. */
  sakerMedFristDenneUka: number;
  /** Hjem sin toppsak står i «venter på svar». */
  toppVenter: boolean;
};

/**
 * Ingressen under «Hei, {navn}» på Hjem (Retning B §5.1). Første regel som
 * treffer gjelder. Ren kode, ingen AI — og ingen løfter på kreditors vegne.
 */
export function hjemIngress(i: HjemIngressInput): string {
  if (i.antallAktive === 0 && i.antallSaker > 0) {
    return "Ingen aktive saker. Godt jobbet.";
  }
  if (i.antallSaker === 0) return "Ett brev om gangen. Vi tar det rolig.";
  if (i.antallUtlopteFrister - i.antallUtlopteFraGamleBrev > 0) {
    return "En frist har gått ut. Se hva du kan gjøre.";
  }
  if (i.sakerMedFristDenneUka > 0) {
    return i.sakerMedFristDenneUka === 1
      ? "Én sak trenger deg denne uka."
      : `${i.sakerMedFristDenneUka} saker trenger deg denne uka.`;
  }
  if (i.toppVenter) return "Du venter på svar. Vi følger med.";
  return i.antallAktive === 1
    ? "Én aktiv sak. Ingen frister denne uka."
    : `${i.antallAktive} aktive saker. Ingen frister denne uka.`;
}

export type SakOppsummering = {
  id: string;
  status: SakStatus;
  utfall: SakUtfall | null;
  belopTotalt: number | null;
  gebyrsjekk: GebyrsjekkResultat | null; // fra sakens nyeste brev
};

export type Oversikt = {
  antallAktive: number;
  antallAvsluttet: number;
  samletKravAktive: number;
  funnetOverSats: number;
  antallSakerMedFunn: number;
  // Historikk (avsluttede saker):
  antallMedhold: number;
  antallAvtale: number;
  antallOppgjort: number;
};

/**
 * Summerer et sett saker til oversiktstallene på Hjem. `samletKravAktive` og
 * `funnetOverSats` teller KUN saker med status ≠ 'fullfort' ('aktiv' og
 * 'venter_pa_svar' begge — samme «aktiv»-definisjon som resten av appen,
 * f.eks. Saker-listens «Aktive»-gruppe). `funnetOverSats` summerer KUN
 * 'over'-linjer, aldri 'mulig_over' eller 'ukjent' (guardrail 1/2).
 */
export function beregnOversikt(saker: SakOppsummering[]): Oversikt {
  let antallAktive = 0;
  let antallAvsluttet = 0;
  let samletKravAktive = 0;
  let funnetOverSats = 0;
  let antallSakerMedFunn = 0;
  let antallMedhold = 0;
  let antallAvtale = 0;
  let antallOppgjort = 0;

  for (const s of saker) {
    if (s.status === "fullfort") {
      antallAvsluttet++;
      if (s.utfall === "medhold" || s.utfall === "delvis_medhold") {
        antallMedhold++;
      } else if (s.utfall === "nedbetalingsavtale") {
        antallAvtale++;
      } else if (s.utfall === "oppgjort") {
        antallOppgjort++;
      }
      continue;
    }

    antallAktive++;
    samletKravAktive += s.belopTotalt ?? 0;

    const overLinjer =
      s.gebyrsjekk?.linjer.filter((l) => l.vurdering === "over") ?? [];
    if (overLinjer.length > 0) {
      antallSakerMedFunn++;
      funnetOverSats += overLinjer.reduce(
        (sum, l) => sum + (l.differanse ?? 0),
        0,
      );
    }
  }

  return {
    antallAktive,
    antallAvsluttet,
    samletKravAktive,
    funnetOverSats,
    antallSakerMedFunn,
    antallMedhold,
    antallAvtale,
    antallOppgjort,
  };
}
