// Meldingene som sendes til chatmodellen for et brev. Ren funksjon, så takene
// kan testes. Brevet er ubetrodde data og avgrenses (A6). Historikken og
// lengdene er begrenset, så kostnaden per spørsmål har et tak (A4).
// Relative importer med .ts-endelse, så filen også kan kjøres direkte av Node.
import { avgrens } from "./dokumentdata.ts";

/** Siste meldinger i samtalen som tas med. Eldre meldinger står i appen, men sendes ikke. */
export const SAMTALE_MAKS_HISTORIKK = 12;
/** Tegn per tidligere melding. */
export const SAMTALE_MAKS_TEGN_MELDING = 2000;
/** Tegn av brevteksten. Innlimte brev er allerede maks 20 000 tegn. */
export const SAMTALE_MAKS_TEGN_BREV = 20000;
/** Svarlengde. */
export const SAMTALE_MAKS_TOKENS = 2000;

export type SamtaleMelding = { role: "user" | "assistant"; content: string };

function kutt(tekst: string, maks: number): string {
  return tekst.length > maks ? `${tekst.slice(0, maks)} […]` : tekst;
}

export function byggSamtale(g: {
  originalTekst: string;
  forklaring: string;
  tidligere: { rolle: string; innhold: string }[];
  melding: string;
}): SamtaleMelding[] {
  let historikk = g.tidligere.slice(-SAMTALE_MAKS_HISTORIKK).map((m) => ({
    role: (m.rolle === "bruker" ? "user" : "assistant") as SamtaleMelding["role"],
    content: kutt(m.innhold, SAMTALE_MAKS_TEGN_MELDING),
  }));
  // Etter forklaringen (assistant) må neste melding være fra brukeren.
  while (historikk.length > 0 && historikk[0].role === "assistant") historikk = historikk.slice(1);

  return [
    { role: "user", content: `Her er teksten fra brevet:\n\n${avgrens(kutt(g.originalTekst, SAMTALE_MAKS_TEGN_BREV))}` },
    { role: "assistant", content: kutt(g.forklaring, SAMTALE_MAKS_TEGN_MELDING) },
    ...historikk,
    { role: "user", content: g.melding },
  ];
}
