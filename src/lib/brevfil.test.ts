import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FEIL,
  KOMPRIMERING,
  MAKS_BASE64_PER_BILDE,
  MAKS_BASE64_TOTALT,
  MAKS_PDF_BYTES,
  MAKS_PDF_SIDER,
  base64Lengde,
  filType,
  komprimerInnenforBudsjett,
  maalStorrelse,
  pdfFeil,
  pdfSideAnslag,
  validerBrevfiler,
} from "./brevfil.ts";

const jpeg = (lengde: number) => ({
  media_type: "image/jpeg",
  data: "/9j/" + "A".repeat(lengde - 4),
});
const pdf = (lengde: number) => ({
  media_type: "application/pdf",
  data: "JVBERi0" + "A".repeat(lengde - 7),
});

// --- Grensene henger sammen ---

test("to fulle bilder får plass i det samlede budsjettet", () => {
  assert.ok(MAKS_BASE64_PER_BILDE * 2 <= MAKS_BASE64_TOTALT);
});

test("det samlede budsjettet ligger under forespørselsgrensen på 4 MB, med margin", () => {
  assert.ok(MAKS_BASE64_TOTALT <= 4 * 1024 * 1024 - 500_000);
});

test("største tillatte PDF får plass i budsjettet som base64", () => {
  assert.ok(base64Lengde(MAKS_PDF_BYTES) <= MAKS_BASE64_TOTALT);
});

test("base64Lengde regner med 4 tegn per 3 byte", () => {
  assert.equal(base64Lengde(3), 4);
  assert.equal(base64Lengde(4), 8);
  assert.equal(base64Lengde(0), 0);
});

// --- Filtype ---

test("filType: bilder, HEIC og PDF kjennes igjen, også uten oppgitt type", () => {
  assert.equal(filType("image/jpeg"), "bilde");
  assert.equal(filType("image/heic"), "bilde");
  assert.equal(filType("application/pdf"), "pdf");
  assert.equal(filType("", "IMG_0001.HEIC"), "bilde");
  assert.equal(filType("", "brev.pdf"), "pdf");
});

test("filType: annet er ukjent", () => {
  assert.equal(filType("text/plain", "brev.txt"), "ukjent");
  assert.equal(filType("", "brev.docx"), "ukjent");
  assert.equal(filType("application/zip", "brev.pdf"), "ukjent");
});

// --- Serverkontroll ---

test("validerBrevfiler: ett og to bilder innenfor grensene godtas", () => {
  assert.equal(validerBrevfiler([jpeg(1000)]), null);
  assert.equal(validerBrevfiler([jpeg(MAKS_BASE64_PER_BILDE), jpeg(MAKS_BASE64_PER_BILDE)]), null);
});

test("validerBrevfiler: ingen filer og for mange filer avvises", () => {
  assert.equal(validerBrevfiler([]), FEIL.ingenFiler);
  assert.equal(validerBrevfiler([jpeg(10), jpeg(10), jpeg(10)]), FEIL.forMangeBilder);
});

test("validerBrevfiler: for stort enkeltbilde avvises", () => {
  assert.equal(validerBrevfiler([jpeg(MAKS_BASE64_PER_BILDE + 1)]), FEIL.forStorSamlet);
});

test("validerBrevfiler: ugyldig format avvises, også med falsk type", () => {
  assert.equal(validerBrevfiler([{ media_type: "text/plain", data: "aGVp" }]), FEIL.format);
  assert.equal(validerBrevfiler([{ media_type: "image/svg+xml", data: "PHN2Zz4=" }]), FEIL.format);
  assert.equal(
    validerBrevfiler([{ media_type: "image/jpeg", data: "aGVpIGhlaQ==" }]),
    FEIL.kunneIkkeLese,
  );
  assert.equal(
    validerBrevfiler([{ media_type: "application/pdf", data: "aGVpIGhlaQ==" }]),
    FEIL.pdfUgyldig,
  );
});

test("validerBrevfiler: manglende felter krasjer ikke", () => {
  assert.equal(validerBrevfiler([{} as never]), FEIL.format);
  assert.equal(validerBrevfiler(null as never), FEIL.ingenFiler);
});

test("validerBrevfiler: PDF alene godtas, sammen med bilde avvises", () => {
  assert.equal(validerBrevfiler([pdf(1000)]), null);
  assert.equal(validerBrevfiler([pdf(1000), jpeg(1000)]), FEIL.pdfBlanding);
});

test("validerBrevfiler: for stor PDF avvises", () => {
  assert.equal(validerBrevfiler([pdf(base64Lengde(MAKS_PDF_BYTES))]), null);
  assert.equal(validerBrevfiler([pdf(base64Lengde(MAKS_PDF_BYTES) + 4)]), FEIL.pdfForStor);
});

test("validerBrevfiler: serveren håndhever også sidegrensen for PDF", () => {
  const medSider = (n: number) => ({
    media_type: "application/pdf",
    data: btoa("%PDF-1.7 " + "<< /Type /Page >> ".repeat(n)),
  });
  assert.equal(validerBrevfiler([medSider(MAKS_PDF_SIDER)]), null);
  assert.equal(validerBrevfiler([medSider(MAKS_PDF_SIDER + 1)]), FEIL.pdfForMangeSider);
});

test("validerBrevfiler: PDF med ødelagt base64 avvises", () => {
  assert.equal(
    validerBrevfiler([{ media_type: "application/pdf", data: "JVBERi0!!!!" }]),
    FEIL.pdfUgyldig,
  );
});

// --- PDF ---

test("pdfSideAnslag teller sider, ikke /Pages-noden", () => {
  assert.equal(pdfSideAnslag("<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>"), 2);
  assert.equal(pdfSideAnslag("komprimert innhold"), 0);
});

test("pdfFeil: gyldig, ugyldig, for stor og for mange sider", () => {
  assert.equal(pdfFeil(1000, "%PDF-1.7", "/Type /Page"), null);
  assert.equal(pdfFeil(1000, "hei", ""), FEIL.pdfUgyldig);
  assert.equal(pdfFeil(MAKS_PDF_BYTES + 1, "%PDF-1.7", ""), FEIL.pdfForStor);
  assert.equal(
    pdfFeil(1000, "%PDF-1.7", "/Type /Page ".repeat(MAKS_PDF_SIDER + 1)),
    FEIL.pdfForMangeSider,
  );
});

test("pdfFeil: ukjent antall sider (komprimert struktur) avvises ikke", () => {
  assert.equal(pdfFeil(1000, "%PDF-1.7", "ingen synlig struktur"), null);
});

// --- Komprimering ---

test("komprimering: stopper på første trinn som holder budsjettet", async () => {
  const brukt: number[] = [];
  const r = await komprimerInnenforBudsjett(async (s) => {
    brukt.push(s.kvalitet);
    return "x".repeat(s.kvalitet > 0.8 ? 200 : 50);
  }, 100);
  assert.equal(r?.steg.kvalitet, 0.75);
  assert.deepEqual(brukt, [0.85, 0.75]);
});

test("komprimering: null når gulvet ikke holder (aldri uleselig kvalitet)", async () => {
  const r = await komprimerInnenforBudsjett(async () => "x".repeat(500), 100);
  assert.equal(r, null);
});

test("komprimering: gulvet bevarer lesbarhet", () => {
  for (const s of KOMPRIMERING) {
    assert.ok(s.langSide >= 1280);
    assert.ok(s.kvalitet >= 0.65);
  }
});

test("maalStorrelse: skalerer lengste side, bevarer forhold, forstørrer aldri", () => {
  assert.deepEqual(maalStorrelse(4000, 3000, 1568), { bredde: 1568, hoyde: 1176 });
  assert.deepEqual(maalStorrelse(3000, 4000, 1568), { bredde: 1176, hoyde: 1568 });
  assert.deepEqual(maalStorrelse(800, 600, 1568), { bredde: 800, hoyde: 600 });
});
