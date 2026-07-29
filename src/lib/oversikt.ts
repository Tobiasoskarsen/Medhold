// Oversikt-motoren for Hjem (MEDHOLD_SUBSTANS_ARBEIDSORDRE §1). Ren summering
// av data appen allerede har lagret — ingen nye AI-kall, ingen rekalkulering
// av gebyrsjekk (det lagrede LinjeResultat er sannheten, jf. gebyrsjekk-ordren).

import type { SakStatus, SakUtfall } from "./types";
import type { GebyrsjekkResultat } from "./gebyr";

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
