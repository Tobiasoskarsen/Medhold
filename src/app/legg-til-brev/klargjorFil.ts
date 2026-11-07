// Gjør en valgt fil klar for brevlesingen, i nettleseren. Bilder skaleres ned og
// kodes på nytt som JPEG (fjerner også EXIF, som kan inneholde GPS-posisjon).
// PDF-er kan ikke komprimeres her, så de kontrolleres mot egne grenser.
// Reglene ligger i lib/brevfil.ts.
import {
  FEIL,
  MAKS_BILDE_BYTES_INN,
  MAKS_PDF_BYTES,
  filType,
  komprimerInnenforBudsjett,
  maalStorrelse,
  pdfFeil,
  type Brevfil,
} from "@/lib/brevfil";

export type KlarFil = Brevfil & { navn: string };
export type Klargjort = { ok: true; fil: KlarFil } | { ok: false; feil: string };

type Kilde = { bilde: CanvasImageSource; bredde: number; hoyde: number; lukk: () => void };

/** Åpner bildet med riktig rotasjon (EXIF). Null = nettleseren kan ikke lese det. */
async function aapneBilde(fil: File): Promise<Kilde | null> {
  try {
    const b = await createImageBitmap(fil, { imageOrientation: "from-image" });
    return { bilde: b, bredde: b.width, hoyde: b.height, lukk: () => b.close() };
  } catch {
    // Eldre Safari kan mangle alternativet: <img> følger også EXIF.
  }
  const url = URL.createObjectURL(fil);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      bilde: img,
      bredde: img.naturalWidth,
      hoyde: img.naturalHeight,
      lukk: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * Skalerer ned i halveringer: ett stort hopp gjør tynn tekst utydelig i noen
 * nettlesere, og små tall er det viktigste i et inkassobrev.
 */
function tegnNedskalert(k: Kilde, bredde: number, hoyde: number): HTMLCanvasElement {
  let kilde: CanvasImageSource = k.bilde;
  let b = k.bredde;
  let h = k.hoyde;
  let canvas = document.createElement("canvas");
  for (;;) {
    const nesteB = Math.max(bredde, Math.round(b / 2));
    const nesteH = Math.max(hoyde, Math.round(h / 2));
    canvas = document.createElement("canvas");
    canvas.width = nesteB;
    canvas.height = nesteH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    // Hvit bunn: gjennomsiktig PNG ville ellers blitt svart i JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, nesteB, nesteH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(kilde, 0, 0, nesteB, nesteH);
    if (nesteB === bredde && nesteH === hoyde) return canvas;
    kilde = canvas;
    b = nesteB;
    h = nesteH;
  }
}

function tilBase64Jpeg(canvas: HTMLCanvasElement, kvalitet: number): string {
  const url = canvas.toDataURL("image/jpeg", kvalitet);
  return url.slice(url.indexOf(",") + 1);
}

async function klargjorBilde(fil: File): Promise<Klargjort> {
  if (fil.size > MAKS_BILDE_BYTES_INN) return { ok: false, feil: FEIL.bildeForStort };
  const kilde = await aapneBilde(fil);
  if (!kilde || kilde.bredde === 0 || kilde.hoyde === 0) {
    return { ok: false, feil: FEIL.kunneIkkeLese };
  }
  try {
    const r = await komprimerInnenforBudsjett(async ({ langSide, kvalitet }) => {
      const m = maalStorrelse(kilde.bredde, kilde.hoyde, langSide);
      return tilBase64Jpeg(tegnNedskalert(kilde, m.bredde, m.hoyde), kvalitet);
    });
    if (!r) return { ok: false, feil: FEIL.bildeForDetaljert };
    return { ok: true, fil: { media_type: "image/jpeg", data: r.data, navn: fil.name } };
  } catch {
    return { ok: false, feil: FEIL.kunneIkkeLese };
  } finally {
    kilde.lukk();
  }
}

function lesSomBase64(fil: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("lesefeil"));
    r.readAsDataURL(fil);
  });
}

async function klargjorPdf(fil: File): Promise<Klargjort> {
  // En for stor PDF leses aldri inn: den skal avvises raskt.
  const hode = await fil.slice(0, 5).text();
  const raa = fil.size <= MAKS_PDF_BYTES ? await lesLatin1(fil) : "";
  const feil = pdfFeil(fil.size, hode, raa);
  if (feil) return { ok: false, feil };
  try {
    return {
      ok: true,
      fil: { media_type: "application/pdf", data: await lesSomBase64(fil), navn: fil.name },
    };
  } catch {
    return { ok: false, feil: FEIL.pdfUgyldig };
  }
}

/** PDF-strukturen er ASCII i binærdata: latin1 taper ingen bytes. */
async function lesLatin1(fil: File): Promise<string> {
  return new TextDecoder("latin1").decode(await fil.arrayBuffer());
}

/** Klargjør én valgt fil for sending. Kaster aldri. */
export async function klargjorFil(fil: File): Promise<Klargjort> {
  const type = filType(fil.type, fil.name);
  try {
    if (type === "pdf") return await klargjorPdf(fil);
    if (type === "bilde") return await klargjorBilde(fil);
  } catch {
    return { ok: false, feil: FEIL.kunneIkkeLese };
  }
  return { ok: false, feil: FEIL.format };
}
