// Felles behandling av svar fra AI-modellen. Et svar er bare brukbart når
// modellen avsluttet normalt OG innholdet har riktig struktur. Alt annet er en
// feil av en bestemt type, slik at et avkuttet eller ugyldig svar aldri lagres
// som en fullført analyse eller et ferdig svarbrev.
// Relative importer med .ts-endelse, så filen også kan kjøres direkte av Node.
import Anthropic from "@anthropic-ai/sdk";

/**
 * Hvorfor et AI-kall ikke ga et brukbart svar:
 * - avbrutt: modellen stoppet før den var ferdig (for langt svar, avslag o.l.)
 * - ugyldig_struktur: svaret mangler felt, har feil type eller er ikke JSON
 * - tidsavbrudd: kallet tok for lang tid
 * - nettverk: fikk ikke kontakt med tjenesten
 * - tjeneste: tjenesten er overbelastet eller har feil (429/5xx)
 * - ukjent: alt annet
 */
export type AiFeil =
  | "avbrutt"
  | "ugyldig_struktur"
  | "tidsavbrudd"
  | "nettverk"
  | "tjeneste"
  | "ukjent";

/** Kostnadsrelevante målinger. Inneholder aldri tekst fra dokumentet. */
export type AiBruk = { inn: number; ut: number; stopp: string | null };

export type AiResultat<T> =
  | { ok: true; data: T; bruk: AiBruk }
  | { ok: false; feil: AiFeil; bruk: AiBruk | null };

/** Feil som ikke skyldes selve innholdet. Brukerens kvote skal ikke belastes. */
export function erOperasjonellFeil(feil: AiFeil): boolean {
  return feil === "tidsavbrudd" || feil === "nettverk" || feil === "tjeneste" || feil === "ukjent";
}

/** Klassifiserer en kastet feil fra SDK-en. */
export function klassifiserAiFeil(e: unknown): AiFeil {
  // Rekkefølgen er viktig: tidsavbrudd er en underklasse av tilkoblingsfeil.
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "tidsavbrudd";
  if (e instanceof Anthropic.APIConnectionError) return "nettverk";
  if (e instanceof Anthropic.APIError) {
    const s = e.status;
    if (s === 408) return "tidsavbrudd";
    if (s === 429 || s === 529 || (typeof s === "number" && s >= 500)) return "tjeneste";
    return "ukjent";
  }
  if (e instanceof Error && e.name === "AbortError") return "tidsavbrudd";
  return "ukjent";
}

/**
 * Om modellen avsluttet normalt. Bare `end_turn` (og `stop_sequence`, som vi
 * ikke bruker) betyr at svaret er komplett. `max_tokens`, `refusal` og ukjente
 * årsaker gir «avbrutt».
 */
export function vurderStopp(stopp: string | null | undefined): AiFeil | null {
  return stopp === "end_turn" || stopp === "stop_sequence" ? null : "avbrutt";
}

export function bruk(svar: Pick<Anthropic.Message, "usage" | "stop_reason">): AiBruk {
  return {
    inn: svar.usage?.input_tokens ?? 0,
    ut: svar.usage?.output_tokens ?? 0,
    stopp: svar.stop_reason ?? null,
  };
}

/**
 * Leser et strukturert (JSON) svar: sjekker at modellen avsluttet normalt,
 * parser JSON og validerer strukturen. `valider` returnerer null når noe
 * mangler eller har feil type.
 */
export function lesStrukturert<T>(
  svar: Pick<Anthropic.Message, "content" | "usage" | "stop_reason">,
  valider: (x: unknown) => T | null,
): AiResultat<T> {
  const b = bruk(svar);
  const stopp = vurderStopp(svar.stop_reason);
  if (stopp) return { ok: false, feil: stopp, bruk: b };

  const blokk = svar.content.find((x) => x.type === "text");
  if (!blokk || blokk.type !== "text") return { ok: false, feil: "ugyldig_struktur", bruk: b };
  let raa: unknown;
  try {
    raa = JSON.parse(blokk.text);
  } catch {
    return { ok: false, feil: "ugyldig_struktur", bruk: b };
  }
  const data = valider(raa);
  return data === null ? { ok: false, feil: "ugyldig_struktur", bruk: b } : { ok: true, data, bruk: b };
}

// --- Byggeklosser for validering ---------------------------------------------

export function erObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Gyldig kalenderdato på formen ÅÅÅÅ-MM-DD. */
export function erIsoDato(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Dato fra modellen: tom streng betyr ukjent. En dato som ikke er en gyldig
 * kalenderdato (f.eks. 2026-02-30) behandles som ukjent, ikke gjettet.
 */
export function datoEllerTom(x: unknown): string | null {
  if (typeof x !== "string") return null;
  return x === "" || erIsoDato(x) ? x : "";
}
