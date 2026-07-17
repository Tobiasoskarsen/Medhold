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
 * - medhold / oppgjort → løst (fullført).
 * - nedbetalingsavtale → fullført, stadium settes til nedbetaling (Plan B §5:
 *   avtalen er «saken har en slutt»; avvik fra Fase C der den var aktiv).
 * - delvis_medhold / avvist → fortsatt aktiv (brukeren trenger ny handling).
 */
export function utfallOvergang(utfall: SakUtfall): UtfallOvergang {
  switch (utfall) {
    case "medhold":
    case "oppgjort":
      return { utfall, status: "fullfort" };
    case "nedbetalingsavtale":
      return { utfall, status: "fullfort", stadium: "nedbetaling" };
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
