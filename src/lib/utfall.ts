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
 * - nedbetalingsavtale → akseptert avtale: avsluttet, stadium nedbetaling.
 * - nedbetalingstilbud → bare et tilbud: saken forblir åpen.
 * - delvis_medhold / avvist → saken forblir åpen, kravet står helt eller delvis.
 */
export function utfallOvergang(utfall: SakUtfall): UtfallOvergang {
  switch (utfall) {
    case "medhold":
    case "oppgjort":
      return { utfall, status: "fullfort" };
    case "nedbetalingsavtale":
      return { utfall, status: "fullfort", stadium: "nedbetaling" };
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
 * Status etter et nytt brev på en eksisterende sak. Et valgt utfall bestemmer.
 * Uten utfall gjør en ny, kommende frist saken aktiv: ellers ville fristen vært
 * skjult bak «venter på svar» eller «avsluttet». Utløpte frister åpner ingenting.
 */
export function statusVedNyttBrev(i: {
  statusNa: SakStatus;
  utfall: SakUtfall | null;
  nyeFrister: string[];
  idag: string;
}): {
  status: SakStatus;
  gjenapnet: boolean;
  /** Bare satt når utfallet skal endres. Undefined = behold dagens utfall. */
  utfall?: SakUtfall | null;
  stadium?: Stadium;
} {
  if (i.utfall) {
    const o = utfallOvergang(i.utfall);
    return { status: o.status, gjenapnet: false, utfall: o.utfall, stadium: o.stadium };
  }
  const harKommendeFrist = i.nyeFrister.some((d) => d >= i.idag);
  if (i.statusNa === "aktiv" || !harKommendeFrist) {
    return { status: i.statusNa, gjenapnet: false };
  }
  // Et gammelt utfall stemmer ikke lenger når en avsluttet sak åpnes igjen.
  return i.statusNa === "fullfort"
    ? { status: "aktiv", gjenapnet: true, utfall: null }
    : { status: "aktiv", gjenapnet: true };
}

export type UtfallVisning = {
  tittel: string;
  under: string | null;
  farge: "text-gull" | "text-trygg" | "text-blekk";
};

/** Hva appen sier om et utfall. Bare medhold kan omtales som at kravet er frafalt. */
export function utfallVisning(utfall: SakUtfall | null): UtfallVisning {
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
      return {
        tittel: "Avtale på plass.",
        under: "Du har en plan — og saken har en slutt.",
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
