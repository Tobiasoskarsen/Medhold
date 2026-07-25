// Små formateringshjelpere for visning og tolkning av beløp.

/** Beløp med norsk tusenskille, uten øre og uten «kr». Null → null. */
export function formaterBelop(
  kroner: number | null | undefined,
): string | null {
  if (kroner == null) return null;
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(
    kroner,
  );
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
