// Statusoverganger ved utfall og nye brev. Ren, testbar logikk: «kode beslutter».
// AI kan foreslå et utfall, men bare brukeren kan bekrefte et som avslutter saken.
// Dette er den ene regelen for statusoverganger. Alle kodeveier skal bruke den.
import type { SakStatus, SakUtfall } from "./types";
import type { Stadium } from "./gjeld";

export type UtfallOvergang = {
  utfall: SakUtfall;
  status: "aktiv" | "fullfort";
  stadium?: Stadium;
};

/**
 * Hva et bekreftet utfall gjør med saken:
 * - medhold / oppgjort → avsluttet.
 * - nedbetalingsavtale → akseptert avtale: saken følges opp (aktiv, stadium
 *   nedbetaling) til den er oppgjort. Betaling gjenstår, så varsler skal fortsette.
 * - nedbetalingstilbud → bare et tilbud: saken forblir åpen.
 * - delvis_medhold / avvist → saken forblir åpen, kravet står helt eller delvis.
 */
export function utfallOvergang(utfall: SakUtfall): UtfallOvergang {
  switch (utfall) {
    case "medhold":
    case "oppgjort":
      return { utfall, status: "fullfort" };
    case "nedbetalingsavtale":
      return { utfall, status: "aktiv", stadium: "nedbetaling" };
    case "nedbetalingstilbud":
    case "delvis_medhold":
    case "avvist":
      return { utfall, status: "aktiv" };
  }
}

/** Avslutter dette valget saken? Null er «Annet / vet ikke», som avslutter uten utfall. */
export function utfallAvslutter(utfall: SakUtfall | null): boolean {
  return utfall === null || utfallOvergang(utfall).status === "fullfort";
}

/** Feltene som skal settes på saken for et valg (én regel for alle kodeveier). */
export function oppdateringForUtfall(utfall: SakUtfall | null): {
  status: "aktiv" | "fullfort";
  utfall: SakUtfall | null;
  stadium?: Stadium;
} {
  if (utfall === null) return { status: "fullfort", utfall: null };
  const o = utfallOvergang(utfall);
  return o.stadium
    ? { status: o.status, utfall: o.utfall, stadium: o.stadium }
    : { status: o.status, utfall: o.utfall };
}

export type SvarUtfall =
  | "medhold"
  | "delvis_medhold"
  | "avvist"
  | "nedbetalingstilbud"
  | "uklart";

/** AI-forslaget (svar_utfall) → sakens utfall-verdi. 'uklart' → null. */
export function svarUtfallTilSak(svar: SvarUtfall): SakUtfall | null {
  return svar === "uklart" ? null : svar;
}

/**
 * Det som kan være forhåndsvalgt: bare forslag som lar saken være åpen. Et forslag
 * som ville avsluttet saken, skal brukeren velge selv.
 */
export function forhandsvalgtUtfall(svar: SvarUtfall): SakUtfall | null {
  const u = svarUtfallTilSak(svar);
  return u !== null && !utfallAvslutter(u) ? u : null;
}

/** AI-forslag som ville avsluttet saken. Vises som hint, aldri som et valg. */
export function avsluttendeForslag(svar: SvarUtfall): SakUtfall | null {
  const u = svarUtfallTilSak(svar);
  return u !== null && utfallAvslutter(u) ? u : null;
}

/**
 * Status etter et nytt brev på en eksisterende sak:
 * - Et valgt utfall bestemmer.
 * - En sak som venter på svar blir aktiv når brevet har en ny, kommende frist,
 *   så fristen ikke skjules. Det er ingen gjenåpning: saken var aldri lukket.
 * - En avsluttet sak åpnes bare når brukeren eksplisitt velger det. Utfallet
 *   beholdes som historikk. `kommendeFrist` lar flyten varsle om at en ny
 *   frist ellers ikke blir fulgt opp.
 */
export function statusVedNyttBrev(i: {
  statusNa: SakStatus;
  utfall: SakUtfall | null;
  nyeFrister: string[];
  idag: string;
  /** Brukeren har krysset av for å åpne en avsluttet sak igjen. */
  gjenapne?: boolean;
}): {
  status: SakStatus;
  /** Statusen endres fra venter eller avsluttet til aktiv. */
  gjenapnet: boolean;
  /** Brevet har en frist fra i dag eller senere. */
  kommendeFrist: boolean;
  /** Bare satt når utfallet skal endres. Undefined = behold dagens utfall. */
  utfall?: SakUtfall | null;
  stadium?: Stadium;
} {
  const kommendeFrist = i.nyeFrister.some((d) => d >= i.idag);
  if (i.utfall) {
    const o = utfallOvergang(i.utfall);
    return {
      status: o.status,
      gjenapnet: false,
      kommendeFrist,
      utfall: o.utfall,
      stadium: o.stadium,
    };
  }
  if (i.statusNa === "fullfort") {
    return i.gjenapne === true
      ? { status: "aktiv", gjenapnet: true, kommendeFrist }
      : { status: "fullfort", gjenapnet: false, kommendeFrist };
  }
  if (i.statusNa === "venter_pa_svar" && kommendeFrist) {
    return { status: "aktiv", gjenapnet: true, kommendeFrist };
  }
  return { status: i.statusNa, gjenapnet: false, kommendeFrist };
}

/**
 * Utfallet som gjelder nå. Et avsluttende utfall (medhold, oppgjort) på en sak
 * som er åpnet igjen er historikk, ikke gjeldende. Bruk dette, ikke kolonnen
 * direkte, når utfallet vises som sakens status.
 */
export function gjeldendeUtfall(
  status: SakStatus,
  utfall: SakUtfall | null,
): SakUtfall | null {
  if (!utfall) return null;
  return status === "fullfort" || !utfallAvslutter(utfall) ? utfall : null;
}

export type UtfallVisning = {
  tittel: string;
  under: string | null;
  farge: "text-gull" | "text-trygg" | "text-blekk";
};

/**
 * Hva appen sier om et utfall. Bare medhold kan omtales som at kravet er
 * frafalt. `avsluttet` er sakens status: et avsluttende utfall på en åpen sak
 * betyr at saken er åpnet igjen.
 */
export function utfallVisning(utfall: SakUtfall | null, avsluttet: boolean): UtfallVisning {
  if (!avsluttet && utfall !== null && utfallAvslutter(utfall)) {
    return {
      tittel: "Saken er åpnet igjen",
      under: `Saken er åpnet igjen. Tidligere utfall: ${UTFALL_NAVN[utfall]}.`,
      farge: "text-blekk",
    };
  }
  switch (utfall) {
    case "medhold":
      return { tittel: "Medhold — kravet er frafalt", under: null, farge: "text-gull" };
    case "delvis_medhold":
      return {
        tittel: "Delvis medhold",
        under: "Kravet er redusert, ikke frafalt. Sjekk hva som gjenstår.",
        farge: "text-blekk",
      };
    case "avvist":
      return {
        tittel: "Innsigelsen er avvist",
        under: "Kravet står fortsatt. Vurder neste steg før fristen.",
        farge: "text-blekk",
      };
    case "nedbetalingstilbud":
      return {
        tittel: "Tilbud om nedbetaling",
        under: "Dette er et tilbud. Det er ingen avtale før du har akseptert.",
        farge: "text-blekk",
      };
    case "nedbetalingsavtale":
      return avsluttet
        ? {
            tittel: "Avtale på plass.",
            under: "Du har en plan — og saken har en slutt.",
            farge: "text-trygg",
          }
        : {
            tittel: "Nedbetaling pågår",
            under:
              "Saken følges opp til hele beløpet er betalt. Registrer det i menyen når siste avdrag er betalt.",
            farge: "text-trygg",
          };
    case "oppgjort":
      return {
        tittel: "Saken er ute av verden.",
        under: "Betalt og avsluttet. Godt jobbet.",
        farge: "text-blekk",
      };
    case null:
      return { tittel: "Sak avsluttet", under: null, farge: "text-blekk" };
  }
}

// Egne navn her (ikke UTFALL_ETIKETT i types.ts), så modulen kan kjøres av Node.
const UTFALL_NAVN: Record<SakUtfall, string> = {
  medhold: "Medhold",
  delvis_medhold: "Delvis medhold",
  avvist: "Avvist",
  nedbetalingstilbud: "Tilbud om nedbetaling",
  nedbetalingsavtale: "Nedbetalingsavtale",
  oppgjort: "Oppgjort",
};
