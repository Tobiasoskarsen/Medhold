// Statusoverganger ved bekreftet utfall (Fase C4). Ren, testbar logikk —
// «kode beslutter». AI foreslår utfallet, brukeren bekrefter, koden avgjør hva
// som skjer med saken.
import type { SakUtfall } from "./types";
import type { Stadium } from "./gjeld";

export type UtfallOvergang = {
  utfall: SakUtfall;
  status: "aktiv" | "fullfort";
  stadium?: Stadium;
};

/**
 * Hva et bekreftet utfall gjør med saken:
 * - medhold → løst (fullført).
 * - delvis_medhold / avvist → fortsatt aktiv (brukeren trenger ny handling).
 * - nedbetalingsavtale → aktiv, stadium settes til nedbetaling.
 */
export function utfallOvergang(utfall: SakUtfall): UtfallOvergang {
  switch (utfall) {
    case "medhold":
      return { utfall, status: "fullfort" };
    case "nedbetalingsavtale":
      return { utfall, status: "aktiv", stadium: "nedbetaling" };
    case "delvis_medhold":
    case "avvist":
      return { utfall, status: "aktiv" };
  }
}

/** AI-forslaget (svar_utfall) → sakens utfall-verdi. 'uklart' → null. */
export function svarUtfallTilSak(
  svar:
    | "medhold"
    | "delvis_medhold"
    | "avvist"
    | "nedbetalingstilbud"
    | "uklart",
): SakUtfall | null {
  if (svar === "uklart") return null;
  if (svar === "nedbetalingstilbud") return "nedbetalingsavtale";
  return svar;
}
