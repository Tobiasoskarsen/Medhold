// Felles kontroll av redirect-mål som kommer utenfra (f.eks. ?next= i en lenke).
// Hindrer åpen redirect: en lenke til vårt domene skal aldri kunne sende brukeren
// videre til et annet nettsted etter innlogging.

const INTERN_BASE = "http://intern.invalid";

/**
 * Returnerer målet som en intern sti (sti + query + hash), eller `fallback` når
 * det ikke er helt sikkert internt. Avviser bl.a. fulle URL-er, `//evil.com`,
 * `/\evil.com`, kontrolltegn og stier som normaliseres til `//evil.com`.
 */
export function internRedirect(maal: string | null | undefined, fallback = "/"): string {
  if (typeof maal !== "string" || !maal.startsWith("/") || maal.startsWith("//")) {
    return fallback;
  }
  // Nettlesere behandler \ som / og fjerner tab og linjeskift før tolking.
  if (/[\\\u0000-\u001f\u007f]/.test(maal)) return fallback;

  let url: URL;
  try {
    url = new URL(maal, INTERN_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERN_BASE) return fallback;
  // «/.//evil.com» normaliseres til stien «//evil.com», som ellers ville blitt
  // tolket som et annet domene når den brukes videre.
  if (url.pathname.startsWith("//")) return fallback;

  return url.pathname + url.search + url.hash;
}
