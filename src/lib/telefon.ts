// Normaliserer et norsk telefonnummer til E.164 (+47…). Returnerer null hvis
// det ikke ser ut som et gyldig nummer. Delt mellom innlogging og Meg.
export function normaliserTelefon(raw: string): string | null {
  const rensket = raw.replace(/[\s-]/g, "");
  if (!rensket) return null;
  let n = rensket;
  if (n.startsWith("0047")) n = `+${n.slice(2)}`;
  if (/^\d{8}$/.test(n)) n = `+47${n}`; // norsk 8-sifret uten landkode
  return /^\+\d{8,15}$/.test(n) ? n : null;
}

/**
 * Om telefon-innlogging er skrudd på. På som standard nå som SMS-leverandøren
 * (Twilio) er konfigurert i Supabase. Kan slås av ved å sette
 * NEXT_PUBLIC_TELEFON_LOGIN="false".
 */
export function telefonLoginPa(): boolean {
  return process.env.NEXT_PUBLIC_TELEFON_LOGIN !== "false";
}
