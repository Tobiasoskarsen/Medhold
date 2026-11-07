// Regler for filer som sendes til brevlesingen. Ren kode uten nettleser- eller
// server-API-er: samme regler håndheves i klienten (før sending) og i
// analyserBrevBilder (ved direkte kall). Klienten viser feilene som tekst.

/** Maks samlet base64-innhold i ÉN forespørsel, uansett antall filer.
 *  next.config.ts sin bodySizeLimit (4 MB) må ligge over dette: differansen er
 *  plass til øvrige data i forespørselen (action-id, JSON, multipart). */
export const MAKS_BASE64_TOTALT = 3_400_000;
/** Hvert bilde får halve budsjettet, så to bilder alltid får plass. */
export const MAKS_BASE64_PER_BILDE = MAKS_BASE64_TOTALT / 2;
export const MAKS_BILDER = 2;

/** Bilder større enn dette dekodes ikke (minnet på telefonen). */
export const MAKS_BILDE_BYTES_INN = 40 * 1024 * 1024;

/** PDF komprimeres ikke, så den har egne grenser. */
export const MAKS_PDF_BYTES = 2_500_000;
export const MAKS_PDF_SIDER = 10;
export const MAKS_PDF_TEKST = "2,5 MB";

/** Typene som faktisk sendes videre. Bilder gjøres alltid om til JPEG først. */
const TILLATTE_TYPER = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type Brevfil = { media_type: string; data: string };

export const FEIL = {
  format: "Vi kan lese bilder (JPEG, PNG, WebP, HEIC) og PDF. Velg en annen fil.",
  kunneIkkeLese: "Kunne ikke åpne bildet. Prøv et annet, eller lim inn teksten.",
  bildeForStort: "Bildet er for stort til å åpnes. Velg et mindre bilde.",
  bildeForDetaljert:
    "Vi klarer ikke å gjøre bildet lite nok uten at små tall blir uleselige. Ta et nytt bilde av bare brevet, eller lim inn teksten.",
  forMangeBilder: `Du kan legge til maks ${MAKS_BILDER} bilder per brev.`,
  pdfForStor: `PDF-en er for stor (maks ${MAKS_PDF_TEKST}). Ta bilde av brevet, eller lim inn teksten.`,
  pdfForMangeSider: `PDF-en har for mange sider (maks ${MAKS_PDF_SIDER}). Del den opp, eller legg inn bare siden med kravet.`,
  pdfUgyldig: "Fila ser ikke ut til å være en gyldig PDF.",
  pdfBlanding: "En PDF må legges inn alene. Fjern de andre filene først.",
  forStorSamlet: "Filene er for store til å sendes samlet. Fjern en av dem.",
  ingenFiler: "Legg til minst ett bilde av brevet.",
} as const;

/** Størrelsen fila får som base64 (4 tegn per 3 byte, rundet opp). */
export function base64Lengde(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

export type FilType = "bilde" | "pdf" | "ukjent";

/** Hva slags fil det er. HEIC o.l. er bilder: nettleseren avgjør om den kan åpnes. */
export function filType(mediaType: string, navn = ""): FilType {
  const t = mediaType.toLowerCase();
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("image/")) return "bilde";
  // Noen systemer oppgir ingen type (f.eks. HEIC på Windows, PDF fra e-post).
  if (t === "") {
    if (/\.pdf$/i.test(navn)) return "pdf";
    if (/\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(navn)) return "bilde";
  }
  return "ukjent";
}

/**
 * Anslår antall sider ved å telle /Type /Page i PDF-ens rå tekst. PDF-er som
 * pakker strukturen i komprimerte strømmer gir 0 (ukjent), og skal da ikke
 * avvises: anslaget er en tidlig, vennlig grense, ikke en garanti.
 */
export function pdfSideAnslag(raaTekst: string): number {
  return (raaTekst.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

/** Feilmelding for en PDF, eller null når den er innenfor grensene. */
export function pdfFeil(bytes: number, hode: string, raaTekst: string): string | null {
  if (!hode.startsWith("%PDF-")) return FEIL.pdfUgyldig;
  if (bytes > MAKS_PDF_BYTES) return FEIL.pdfForStor;
  if (pdfSideAnslag(raaTekst) > MAKS_PDF_SIDER) return FEIL.pdfForMangeSider;
  return null;
}

/** Sideanslag for en PDF i base64. Null = ikke gyldig base64. */
function pdfSiderFraBase64(data: string): number | null {
  try {
    return pdfSideAnslag(atob(data));
  } catch {
    return null;
  }
}

/** Første tegn i base64 for hver type (de faste «magiske» bytene i filen). */
const BASE64_HODE: Record<string, string[]> = {
  "image/jpeg": ["/9j/"],
  "image/png": ["iVBORw0KGgo"],
  "image/webp": ["UklGR"],
  "application/pdf": ["JVBERi0"],
};

/**
 * Serverens kontroll av det som faktisk kom inn: type, innhold, antall og
 * samlet størrelse. Stoler ikke på klientens oppgitte type.
 * Returnerer feilmelding, eller null når alt er i orden.
 */
export function validerBrevfiler(filer: Brevfil[]): string | null {
  if (!Array.isArray(filer) || filer.length === 0) return FEIL.ingenFiler;
  if (filer.length > MAKS_BILDER) return FEIL.forMangeBilder;

  let totalt = 0;
  let pdfer = 0;
  for (const f of filer) {
    if (typeof f?.media_type !== "string" || typeof f?.data !== "string") return FEIL.format;
    if (!TILLATTE_TYPER.includes(f.media_type)) return FEIL.format;
    if (!BASE64_HODE[f.media_type].some((h) => f.data.startsWith(h))) {
      return f.media_type === "application/pdf" ? FEIL.pdfUgyldig : FEIL.kunneIkkeLese;
    }
    if (f.media_type === "application/pdf") {
      pdfer++;
      if (f.data.length > base64Lengde(MAKS_PDF_BYTES)) return FEIL.pdfForStor;
      const sider = pdfSiderFraBase64(f.data);
      if (sider === null) return FEIL.pdfUgyldig;
      if (sider > MAKS_PDF_SIDER) return FEIL.pdfForMangeSider;
    } else if (f.data.length > MAKS_BASE64_PER_BILDE) {
      return FEIL.forStorSamlet;
    }
    totalt += f.data.length;
  }
  if (pdfer > 0 && filer.length > 1) return FEIL.pdfBlanding;
  if (totalt > MAKS_BASE64_TOTALT) return FEIL.forStorSamlet;
  return null;
}

// --- Komprimering ---------------------------------------------------------

export type KomprimeringSteg = { langSide: number; kvalitet: number };

/**
 * Trinnene for bildekomprimering, fra best til dårligst. Vi starter på 1568 px
 * lengste side: større bilder nedskaleres uansett før modellen leser dem, så
 * mer gir ingen ekstra lesbarhet. Gulvet (1280 px, kvalitet 0,65) er satt for
 * at små beløp, datoer og saksnummer skal forbli lesbare. Klarer vi ikke
 * budsjettet der, avvises bildet heller enn å bli uleselig.
 */
export const KOMPRIMERING: readonly KomprimeringSteg[] = [
  { langSide: 1568, kvalitet: 0.85 },
  { langSide: 1568, kvalitet: 0.75 },
  { langSide: 1568, kvalitet: 0.65 },
  { langSide: 1280, kvalitet: 0.75 },
  { langSide: 1280, kvalitet: 0.65 },
];

/**
 * Går gjennom trinnene til resultatet er innenfor budsjettet. `lag` gjør selve
 * kodingen og returnerer base64 (uten prefiks). Null = gulvet holder ikke.
 */
export async function komprimerInnenforBudsjett(
  lag: (steg: KomprimeringSteg) => Promise<string>,
  budsjett: number = MAKS_BASE64_PER_BILDE,
): Promise<{ data: string; steg: KomprimeringSteg } | null> {
  for (const steg of KOMPRIMERING) {
    const data = await lag(steg);
    if (data.length <= budsjett) return { data, steg };
  }
  return null;
}

/** Målstørrelse for en lengste side, uten forstørring. */
export function maalStorrelse(
  bredde: number,
  hoyde: number,
  langSide: number,
): { bredde: number; hoyde: number } {
  const skala = Math.min(1, langSide / Math.max(bredde, hoyde));
  return {
    bredde: Math.max(1, Math.round(bredde * skala)),
    hoyde: Math.max(1, Math.round(hoyde * skala)),
  };
}
