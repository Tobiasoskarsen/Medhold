import { test } from "node:test";
import assert from "node:assert/strict";

import {
  byggVaktFakta,
  kontrollerUtkast,
  trekkUt,
  verdierMedKilde,
  type VaktGrunnlag,
} from "./utkast-vakt.ts";
import { REFERANSEBREV, REFERANSEBREV_TILLEGG } from "./utkast-stemme.ts";

function grunnlag(over: Partial<VaktGrunnlag>): VaktGrunnlag {
  return {
    originalTekst: "",
    belopTotalt: null,
    belopHovedstol: null,
    kostnadslinjer: [],
    gebyrsjekk: null,
    ubestridt: null,
    avdrag: null,
    detaljer: "",
    brevdato: null,
    fristdato: null,
    idag: "2026-07-20",
    omfang: null,
    ...over,
  };
}

// --- Referansebrevene med sine egne fakta → 0 funn ----------------------------

test("referansebrev 1 (innsigelse, helt) → 0 funn", () => {
  const fakta = byggVaktFakta(
    grunnlag({
      originalTekst:
        "Betalingsoppfordring fra Pulsløft Treningssenter AS. Saksnummer FK-2026-88213. Datert 12. juli 2026. Krever 3 243,20 kr for medlemskap januar–mars 2026.",
      belopTotalt: 3243.2,
      // Datoene personen oppga (oppsigelse og avslutning) står i detaljene.
      detaljer:
        "sa opp 28. november 2025, medlemskapet var avsluttet 31. desember 2025, har eposten som bevis",
      brevdato: "2026-07-12",
      omfang: "helt",
    }),
  );
  assert.deepEqual(kontrollerUtkast(REFERANSEBREV.innsigelse, fakta), []);
});

test("referansebrev 2 (innsigelse, delvis) → 0 funn", () => {
  const fakta = byggVaktFakta(
    grunnlag({
      originalTekst:
        "Betalingsoppfordring. Saksnummer KY-2026-3341. Datert 13. juli 2026. Hovedkrav 2 400 kr. Inkassosalær 800 kr.",
      belopTotalt: 3200,
      belopHovedstol: 2400,
      kostnadslinjer: [{ belop: 800 }],
      gebyrsjekk: { linjer: [{ maksLav: 300, maksHoy: 750, differanse: 50 }] },
      ubestridt: 3150,
      brevdato: "2026-07-13",
      omfang: "delvis",
    }),
  );
  assert.deepEqual(kontrollerUtkast(REFERANSEBREV_TILLEGG.innsigelseDelvis, fakta), []);
});

test("referansebrev 3 (nedbetaling) → 0 funn", () => {
  const fakta = byggVaktFakta(
    grunnlag({
      originalTekst:
        "Betalingsoppfordring. Saksnummer FK-2026-88213. Datert 12. juli 2026. Krav 3 243,20 kr.",
      belopTotalt: 3243.2,
      avdrag: { manedsbelop: 500, antallMandeder: 7, sisteAvdrag: 243.2 },
      detaljer: "første betaling 1. august 2026",
      brevdato: "2026-07-12",
    }),
  );
  assert.deepEqual(kontrollerUtkast(REFERANSEBREV.nedbetalingsavtale, fakta), []);
});

test("referansebrev 4 (utsettelse) → 0 funn", () => {
  const fakta = byggVaktFakta(
    grunnlag({
      originalTekst:
        "Inkassovarsel. Saksnummer AG-2026-04471. Datert 10. juli 2026. Betalingsfrist 24. juli 2026.",
      detaljer: "får lønn 15. august",
      brevdato: "2026-07-10",
      fristdato: "2026-07-24",
    }),
  );
  assert.deepEqual(kontrollerUtkast(REFERANSEBREV.betalingsutsettelse, fakta), []);
});

test("referansebrev 5 (rettslig nedbetaling, utfylt) → 0 funn", () => {
  const brev = REFERANSEBREV_TILLEGG.nedbetalingRettslig
    .replace("{inkassoselskap}", "Inkassohuset AS")
    .replace("{saksnr}", "IH-2026-55120")
    .replace("{dato}", "15. juli 2026")
    .replace("{beløp}", "4 800 kr")
    .replace("{månedsbeløp}", "600 kr")
    .replace("{antall}", "8")
    .replace("{siste avdrag}", "600 kr")
    .replace("{navn}", "Kari Eksempel");
  const fakta = byggVaktFakta(
    grunnlag({
      originalTekst:
        "Varsel om rettslig inndriving. Saksnummer IH-2026-55120. Datert 15. juli 2026. Krav 4 800 kr.",
      belopTotalt: 4800,
      avdrag: { manedsbelop: 600, antallMandeder: 8, sisteAvdrag: 600 },
      brevdato: "2026-07-15",
    }),
  );
  assert.deepEqual(kontrollerUtkast(brev, fakta), []);
});

// --- Enkeltvaktene --------------------------------------------------------------

const brev13 = grunnlag({
  originalTekst:
    "Inkassovarsel. Saksnr. 9999.13.33820. Datert 20. juli 2026. Hovedstol 1 250,00 kr. Inkassovarselgebyr 38,00 kr. Å betale 1 288,00 kr innen 3. august 2026.",
  belopTotalt: 1288,
  belopHovedstol: 1250,
  kostnadslinjer: [{ belop: 38 }],
  brevdato: "2026-07-20",
  fristdato: "2026-08-03",
});

test("289 i stedet for 1 288 → belop-funn", () => {
  const funn = kontrollerUtkast(
    "Hei,\n\nJeg har mottatt inkassovarselet deres om 289 kr.",
    byggVaktFakta(brev13),
  );
  assert.equal(funn.length, 1);
  assert.equal(funn[0].type, "belop");
  assert.equal(funn[0].tekst, "289 kr finnes ikke i brevet ditt. Sjekk beløpet.");
  assert.equal(
    funn[0].rettelinje,
    "Beløpet 289 kr finnes ikke i saken. Bruk kun beløp fra brevet eller fakta fra Medhold.",
  );
});

test("riktig beløp i ulike skrivemåter → ingen funn", () => {
  const fakta = byggVaktFakta(brev13);
  for (const s of ["1 288 kr", "1288 kr", "1.288,00 kr", "kr 1 288,-", "1 250 kr", "38 kr"]) {
    assert.deepEqual(kontrollerUtkast(`Kravet er på ${s}.`, fakta), [], s);
  }
});

test("«§ 9» → paragraf-funn (og 9 regnes ikke som beløp)", () => {
  const funn = kontrollerUtkast(
    "Etter inkassoloven § 9 må fristen være 14 dager.",
    byggVaktFakta(brev13),
  );
  assert.deepEqual(funn.map((f) => f.type), ["paragraf"]);
  assert.equal(funn[0].rettelinje, "Fjern paragrafhenvisningen.");
});

test("ordet «paragraf» → paragraf-funn", () => {
  const funn = kontrollerUtkast("Dette følger av paragrafen om salær.", byggVaktFakta(brev13));
  assert.deepEqual(funn.map((f) => f.type), ["paragraf"]);
});

test("«Jeg har betalt» uten «betal» i detaljer → pastand-funn", () => {
  const funn = kontrollerUtkast(
    "Jeg har betalt kravet allerede.",
    byggVaktFakta({ ...brev13, detaljer: "jeg er uenig" }),
  );
  assert.deepEqual(funn.map((f) => f.type), ["pastand"]);
  assert.equal(
    funn[0].rettelinje,
    "Personen har ikke skrevet at hen har betalt. Fjern påstanden.",
  );
});

test("«Jeg har betalt» med «betalte» i detaljer → ingen funn", () => {
  const funn = kontrollerUtkast(
    "Jeg har betalt kravet allerede.",
    byggVaktFakta({ ...brev13, detaljer: "jeg betalte i juni" }),
  );
  assert.deepEqual(funn, []);
});

test("påstand uten «jeg»/«meg» i setningen → ingen funn", () => {
  const funn = kontrollerUtkast("Kravet er betalt.", byggVaktFakta(brev13));
  assert.deepEqual(funn, []);
});

test("delvis omfang + «jeg betaler ikke kravet» → omfang-funn", () => {
  const funn = kontrollerUtkast(
    "Jeg betaler ikke kravet.",
    byggVaktFakta({ ...brev13, omfang: "delvis" }),
  );
  assert.deepEqual(funn.map((f) => f.type), ["omfang"]);
});

test("helt omfang + «jeg betaler ikke kravet» → ingen funn", () => {
  const funn = kontrollerUtkast(
    "Jeg betaler ikke kravet.",
    byggVaktFakta({ ...brev13, omfang: "helt" }),
  );
  assert.deepEqual(funn, []);
});

test("delvis: «jeg har betalt den ubestridte delen» er alltid tillatt", () => {
  const funn = kontrollerUtkast(
    "Jeg har betalt den ubestridte delen.",
    byggVaktFakta({ ...brev13, omfang: "delvis" }),
  );
  assert.deepEqual(funn, []);
});

test("«14 dager» → ingen funn", () => {
  assert.deepEqual(
    kontrollerUtkast("Loven gir meg 14 dager.", byggVaktFakta(brev13)),
    [],
  );
});

test("årstall og «i 7 måneder» → ingen funn", () => {
  assert.deepEqual(
    kontrollerUtkast("Medlemskapet i 2026 varte i 7 måneder.", byggVaktFakta(brev13)),
    [],
  );
});

// --- Datoer og tokens -----------------------------------------------------------

test("dato i brevet i alle tre former → ingen funn", () => {
  const fakta = byggVaktFakta(brev13);
  for (const d of ["20. juli 2026", "20. juli", "20.07.2026", "3. august"]) {
    assert.deepEqual(kontrollerUtkast(`Brevet er datert ${d}.`, fakta), [], d);
  }
});

test("oppdiktet dato → dato-funn; feil år → dato-funn", () => {
  const fakta = byggVaktFakta(brev13);
  assert.deepEqual(
    kontrollerUtkast("Brevet er datert 21. juli 2026.", fakta).map((f) => f.type),
    ["dato"],
  );
  assert.deepEqual(
    kontrollerUtkast("Brevet er datert 20. juli 2025.", fakta).map((f) => f.type),
    ["dato"],
  );
});

test("dato uten år i brevet godtar utkastets år", () => {
  const fakta = byggVaktFakta(grunnlag({ originalTekst: "Betal innen 24. juli." }));
  assert.deepEqual(kontrollerUtkast("Fristen er 24. juli 2026.", fakta), []);
});

test("saksnummer ordrett → ingen funn; endret → token-funn", () => {
  const fakta = byggVaktFakta(brev13);
  assert.deepEqual(kontrollerUtkast("Saksnr. 9999.13.33820.", fakta), []);
  assert.deepEqual(
    kontrollerUtkast("Saksnr. 9999.13.33821.", fakta).map((f) => f.type),
    ["token"],
  );
});

test("trekkUt: ISO-dato, langdato og tall holdes fra hverandre", () => {
  const u = trekkUt("FK-2026-88213 den 12. juli 2026 krever 3 243,20 kr (2026-07-12).");
  assert.deepEqual(u.tokens, ["FK-2026-88213"]);
  assert.equal(u.datoer.length, 2);
  assert.deepEqual(u.belop.map((b) => b.belop), [3243.2]);
});

// --- Kilder ---------------------------------------------------------------------

test("verdierMedKilde: første kilde i rekkefølgen, null når ukjent", () => {
  const fakta = byggVaktFakta({
    ...brev13,
    gebyrsjekk: { linjer: [{ maksLav: 38, maksHoy: 38, differanse: null }] },
    ubestridt: 1250,
    detaljer: "jeg kan betale 400 kr",
  });
  const linjer = verdierMedKilde(
    "Kravet er 1 288 kr. Jeg betaler 400 kr. Ikke 289 kr. Datert 20. juli 2026.",
    fakta,
  );
  assert.deepEqual(linjer, [
    { type: "belop", verdi: "1 288 kr", kilde: "fra brevet" },
    { type: "belop", verdi: "400 kr", kilde: "fra deg" },
    { type: "belop", verdi: "289 kr", kilde: null },
    { type: "dato", verdi: "20. juli 2026", kilde: "fra brevet" },
  ]);
});
