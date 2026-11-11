// Små formateringshjelpere for visning og tolkning av beløp.

export type Kravbelop =
  | { status: "ukjent" }
  | { status: "ugyldig"; feil: string }
  | { status: "gyldig"; ore: number; kroner: number };

/** Streng inputgrense for manuelle krav. Beholder tolkKr for eksisterende bruk. */
export function validerKravbelop(input: unknown): Kravbelop {
  const feil = { status: "ugyldig", feil: "Skriv et positivt beløp eller 0, med maks to desimaler. Bruk komma for øre, for eksempel 3 243,20. La feltet stå tomt hvis beløpet er ukjent." } as const;
  if (typeof input !== "string" || input.length > 40) return feil;
  const s = input.trim().replace(/[\u00a0\u202f]/g, " ");
  if (!s) return { status: "ukjent" };
  // Ikke fjern vilkårlige tegn: det gjorde tidligere negative og ugyldige
  // verdier uatskillelige fra positive beløp eller manglende opplysninger.
  if (!/^(?:\d+|\d{1,3}(?: \d{3})+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)) return feil;
  const [hele, desimal = ""] = s.split(",");
  const ore = Number(hele.replace(/[ .]/g, "")) * 100 + Number(desimal.padEnd(2, "0"));
  // Maks 9 999 999 999,99 kr: eksplisitt produktgrense, under JS safe integer.
  if (!Number.isSafeInteger(ore) || ore > 999_999_999_999) return feil;
  return { status: "gyldig", ore, kroner: tolkKr(s)! };
}

const HELE_KRONER = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const MED_ORE = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * «2 340» for hele kroner, «3 108,90» når beløpet har øre. Uten «kr».
 * Øre vises alltid med to sifre: «3 108,9» leses som en feil, og havnet
 * tidligere også i utkast til kreditor. Tusenskillet er det Intl bruker (NBSP).
 */
export function formaterKr(kroner: number): string {
  return Math.abs(kroner - Math.round(kroner)) < 0.005
    ? HELE_KRONER.format(Math.round(kroner))
    : MED_ORE.format(kroner);
}

/** Beløp med norsk tusenskille og registrert øre, uten «kr». Null → null. */
export function formaterBelop(
  kroner: number | null | undefined,
): string | null {
  if (kroner == null) return null;
  return formaterKr(kroner);
}

/**
 * Retter «3 108,9 kr» til «3 108,90 kr» i ferdig utkasttekst: et tall med
 * nøyaktig én desimal rett før «kr». Andre tall og datoer røres ikke. Brukes
 * bare på tekst modellen har skrevet, aldri på tekst brukeren har redigert.
 */
export function normaliserBelopITekst(tekst: string): string {
  return tekst.replace(/(\d),(\d)(?=\s*kr\b)/g, "$1,$20");
}

/**
 * Tolker en beløpstekst til et tall. Godtar norsk format (mellomrom eller
 * punktum som tusenskille, komma som desimaltegn — «3 201,80», «3.201,80»)
 * og vanlig internasjonalt format («3201.80»). Kun et skilletegn etterfulgt
 * av 1–2 sifre HELT på slutten regnes som desimaltegn/øre — alt annet
 * punktum/mellomrom tolkes som tusenskille og fjernes. «kr» ryddes bort.
 * Tom eller ugyldig streng → null.
 *
 * Fikser en reell feil: da AI-skjemaet ba om beløpet «kun sifre», strippet
 * modellen desimaltegnet og «3201,80» ble til «320180» (se
 * legg-til-brev/actions.ts). Denne funksjonen er nå eneste sted beløp
 * tolkes fra fritekst, slik at samme feil ikke kan snike seg inn to steder.
 */
export function tolkKr(s: string | null | undefined): number | null {
  if (!s) return null;
  const rensket = s.replace(/kr\.?/gi, "").trim();
  if (!rensket) return null;

  const desimalMatch = rensket.match(/[.,](\d{1,2})$/);
  const heltallDel = desimalMatch
    ? rensket.slice(0, rensket.length - desimalMatch[0].length)
    : rensket;
  const desimalDel = desimalMatch ? desimalMatch[1] : "";
  const heltall = heltallDel.replace(/[^\d]/g, "");

  if (!heltall && !desimalDel) return null;
  const n = Number(`${heltall || "0"}.${desimalDel || "0"}`);
  return Number.isNaN(n) ? null : n;
}

/** Teller ord i en tekst (skilt av ett eller flere mellomrom/linjeskift). */
export function tellOrd(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length;
}

/** Kutter en liste til maks N elementer, uten å endre rekkefølgen. Brukt til
 * å håndheve tak som «maks 3 steg» deterministisk, uten AI. */
export function kuttTilMaks<T>(liste: T[], maks: number): T[] {
  return liste.slice(0, maks);
}
