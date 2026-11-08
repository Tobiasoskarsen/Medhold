// Strukturert, personvernvennlig logging på serveren. Loggene skal kunne
// brukes til feilsøking og kostnadsmåling uten å inneholde brev, forklaringer,
// utkast, modellsvar, e-postadresser eller fødselsnumre.
//
// Derfor slipper bare tall, sannhetsverdier og korte tekniske koder gjennom.
// Alt annet byttes ut med en markør. Kalleren kan ikke ved et uhell logge
// fritekst, fordi den aldri når loggen.

export type LoggNiva = "info" | "warn" | "error";
export type LoggData = Record<string, unknown>;

/** Korte, tekniske verdier: feilkoder, typer, statuser. Aldri fritekst. */
const KODE = /^[a-z0-9_.:-]{1,48}$/i;
/**
 * Ser ut som et fødselsnummer, kontonummer, telefonnummer o.l.: sju eller flere
 * sifre totalt, også med skilletegn imellom (f.eks. 1234.56.78903).
 */
function harMangeSifre(s: string): boolean {
  return (s.match(/\d/g) ?? []).length >= 7;
}

/** Én verdi som kan logges, eller en markør som sier hva som ble holdt tilbake. */
export function rensVerdi(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    if (KODE.test(v) && !harMangeSifre(v)) return v;
    return "[holdt tilbake]";
  }
  return "[holdt tilbake]";
}

export function rensData(data: LoggData = {}): Record<string, string | number | boolean | null> {
  const ut: Record<string, string | number | boolean | null> = {};
  for (const [nokkel, verdi] of Object.entries(data)) {
    if (!KODE.test(nokkel)) continue;
    ut[nokkel] = rensVerdi(verdi);
  }
  return ut;
}

/** Bygger loggraden (eksportert for test). */
export function loggRad(kilde: string, hendelse: string, data?: LoggData): string {
  return JSON.stringify({
    kilde: rensVerdi(kilde),
    hendelse: rensVerdi(hendelse),
    ...rensData(data),
  });
}

export function logg(niva: LoggNiva, kilde: string, hendelse: string, data?: LoggData): void {
  const rad = loggRad(kilde, hendelse, data);
  if (niva === "error") console.error(rad);
  else if (niva === "warn") console.warn(rad);
  else console.info(rad);
}

/** Bare feilens type og eventuelle kode/status, aldri meldingen. */
export function feilInfo(e: unknown): LoggData {
  if (e instanceof Error) {
    const x = e as Error & { code?: unknown; status?: unknown };
    return { feil: x.name, kode: x.code, status: x.status };
  }
  return { feil: typeof e };
}
