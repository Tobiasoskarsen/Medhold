import { test } from "node:test";
import assert from "node:assert/strict";

import {
  satserForDato,
  sjekkKostnader,
  gebyrFunnTekst,
  trinnEtikett,
  utregningRaderForLinje,
  SATSVERSJONER,
  type Kostnadslinje,
} from "./gebyr.ts";

// Hjelper: vurder én linje og hent ut resultatet.
function vurder(
  linje: Kostnadslinje,
  hovedstol: number | null = null,
  brevdato: string | null = "2026-06-01",
) {
  return sjekkKostnader([linje], hovedstol, brevdato).linjer[0];
}

// --- Satstabellen selv ---------------------------------------------------

test("2026-versjonen har de verifiserte faste satsene", () => {
  const s = satserForDato("2026-06-01");
  assert.equal(s.inkassosats, 750);
  assert.equal(s.purregebyr, 38);
  assert.equal(s.inkassovarselGebyr, 38);
  assert.equal(s.betalingsoppfordringGebyr, 113);
  assert.equal(s.rettsgebyr, 1345);
});

test("satserForDato(null) → nyeste versjon", () => {
  const nyeste = [...SATSVERSJONER].sort((a, b) =>
    a.gyldigFra.localeCompare(b.gyldigFra),
  )[SATSVERSJONER.length - 1];
  assert.equal(satserForDato(null).gyldigFra, nyeste.gyldigFra);
});

// --- Salærtrinn-grenser --------------------------------------------------

test("hovedstol treffer riktig salærtrinn på grensene", () => {
  const s = satserForDato("2026-06-01");
  // Beløp midt i hvert trinns A/B-spenn → vurdering mulig_over uansett trinn,
  // men vi verifiserer trinnvalget via maksHoy (tungB per trinn).
  const cases: Array<[number, number]> = [
    [500, 468.75],
    [501, 656.25],
    [1000, 656.25],
    [2500, 750],
    [10000, 1500],
    [50000, 3000],
    [250000, 6750],
    [250001, 13500],
  ];
  for (const [hovedstol, tungB] of cases) {
    const r = vurder({ type: "salaer", belop: 999999, tekst: "salær" }, hovedstol);
    assert.equal(r.maksHoy, tungB, `hovedstol ${hovedstol} → tungB ${tungB}`);
  }
  void s;
});

// --- Faste gebyrer + slingring ------------------------------------------

test("purregebyr 38 innenfor, 39 innenfor (slingring), 40 over", () => {
  assert.equal(vurder({ type: "purregebyr", belop: 38, tekst: "" }).vurdering, "innenfor");
  assert.equal(vurder({ type: "purregebyr", belop: 39, tekst: "" }).vurdering, "innenfor");
  const over = vurder({ type: "purregebyr", belop: 40, tekst: "" });
  assert.equal(over.vurdering, "over");
  assert.equal(over.differanse, 2);
});

test("purregebyr 70 → over med differanse 32 (akseptansekriterium)", () => {
  const r = vurder({ type: "purregebyr", belop: 70, tekst: "Purregebyr: 70 kr" });
  assert.equal(r.vurdering, "over");
  assert.equal(r.differanse, 32);
});

// --- Salær: innenfor / mulig_over / over --------------------------------

test("salær under enkelA → innenfor", () => {
  // hovedstol 10000 → enkelA 600, tungB 1500
  const r = vurder({ type: "salaer", belop: 600, tekst: "" }, 10000);
  assert.equal(r.vurdering, "innenfor");
  assert.equal(r.maksLav, 600);
  assert.equal(r.maksHoy, 1500);
});

test("salær mellom enkelA og tungB → mulig_over", () => {
  const r = vurder({ type: "salaer", belop: 900, tekst: "" }, 10000);
  assert.equal(r.vurdering, "mulig_over");
  assert.equal(r.differanse, null);
});

test("salær over tungB → over med differanse", () => {
  const r = vurder({ type: "salaer", belop: 2100, tekst: "" }, 10000);
  assert.equal(r.vurdering, "over");
  assert.equal(r.differanse, 600); // 2100 - 1500
});

test("salær uten hovedstol → ukjent", () => {
  const r = vurder({ type: "salaer", belop: 1000, tekst: "" }, null);
  assert.equal(r.vurdering, "ukjent");
});

test("hovedstol 2400 + salær 800 → over (ikke nedgrader ekte brudd)", () => {
  // Trinn t.o.m. 2500 → tungB 750. 800 > 750 → over. Ville blitt kun mulig_over
  // om man feilaktig brukte totalbeløpet (~3200 → 10000-trinnet, maks 1500).
  const r = vurder({ type: "salaer", belop: 800, tekst: "" }, 2400);
  assert.equal(r.vurdering, "over");
  assert.equal(r.maksHoy, 750);
  assert.equal(r.differanse, 50);
});

// --- Alltid-ukjent-typer -------------------------------------------------

test("forsinkelsesrente, rettsgebyr, annet → alltid ukjent", () => {
  assert.equal(vurder({ type: "forsinkelsesrente", belop: 500, tekst: "" }).vurdering, "ukjent");
  assert.equal(vurder({ type: "rettsgebyr", belop: 1345, tekst: "" }).vurdering, "ukjent");
  assert.equal(vurder({ type: "annet", belop: 99, tekst: "" }).vurdering, "ukjent");
});

// --- Brevdato før eldste versjon ----------------------------------------

test("brevdato før eldste versjon → alle linjer ukjent", () => {
  const res = sjekkKostnader(
    [{ type: "purregebyr", belop: 70, tekst: "" }],
    null,
    "2020-01-01",
  );
  assert.equal(res.linjer[0].vurdering, "ukjent");
  assert.equal(res.antallOver, 0);
});

// --- Aggregater ----------------------------------------------------------

test("antallOver og antallMuligOver telles riktig", () => {
  const res = sjekkKostnader(
    [
      { type: "purregebyr", belop: 70, tekst: "" }, // over
      { type: "salaer", belop: 900, tekst: "" }, // mulig_over (hovedstol 10000)
      { type: "inkassovarselgebyr", belop: 38, tekst: "" }, // innenfor
    ],
    10000,
    "2026-06-01",
  );
  assert.equal(res.antallOver, 1);
  assert.equal(res.antallMuligOver, 1);
});

// --- gebyrFunnTekst ------------------------------------------------------

test("gebyrFunnTekst tom uten over-funn", () => {
  const res = sjekkKostnader(
    [{ type: "purregebyr", belop: 38, tekst: "" }],
    null,
    "2026-06-01",
  );
  assert.equal(gebyrFunnTekst(res), "");
});

test("gebyrFunnTekst nevner ikke mulig_over", () => {
  const res = sjekkKostnader(
    [{ type: "salaer", belop: 900, tekst: "" }],
    10000,
    "2026-06-01",
  );
  assert.equal(gebyrFunnTekst(res), "");
});

test("gebyrFunnTekst med ett funn", () => {
  const res = sjekkKostnader(
    [{ type: "purregebyr", belop: 70, tekst: "" }],
    null,
    "2026-06-01",
  );
  const tekst = gebyrFunnTekst(res);
  assert.match(tekst, /1\.1\.2026/);
  assert.match(tekst, /purregebyr på 70 kr/);
  assert.match(tekst, /38 kr/);
  assert.match(tekst, /32 kr/);
});

test("gebyrFunnTekst med to funn skiller med semikolon", () => {
  const res = sjekkKostnader(
    [
      { type: "purregebyr", belop: 70, tekst: "" },
      { type: "salaer", belop: 2100, tekst: "" },
    ],
    10000,
    "2026-06-01",
  );
  const tekst = gebyrFunnTekst(res);
  assert.match(tekst, /purregebyr på 70 kr/);
  assert.match(tekst, /inkassosalær på 2\s?100 kr/);
  assert.ok(tekst.includes(";"), "to funn skal skilles med semikolon");
});

// --- trinnEtikett («Hvordan vi regnet dette ut») --------------------------

test("trinnEtikett: grensene 500/1000/2500/10000/50000/250000/over", () => {
  const sats = satserForDato("2026-06-01");
  assert.match(trinnEtikett(500, sats), /t\.o\.m\. 500 kr/);
  assert.match(trinnEtikett(501, sats), /t\.o\.m\. 1\s?000 kr/);
  assert.match(trinnEtikett(1000, sats), /t\.o\.m\. 1\s?000 kr/);
  assert.match(trinnEtikett(1001, sats), /t\.o\.m\. 2\s?500 kr/);
  assert.match(trinnEtikett(2500, sats), /t\.o\.m\. 2\s?500 kr/);
  assert.match(trinnEtikett(2501, sats), /t\.o\.m\. 10\s?000 kr/);
  assert.match(trinnEtikett(10000, sats), /t\.o\.m\. 10\s?000 kr/);
  assert.match(trinnEtikett(10001, sats), /t\.o\.m\. 50\s?000 kr/);
  assert.match(trinnEtikett(50000, sats), /t\.o\.m\. 50\s?000 kr/);
  assert.match(trinnEtikett(50001, sats), /t\.o\.m\. 250\s?000 kr/);
  assert.match(trinnEtikett(250000, sats), /t\.o\.m\. 250\s?000 kr/);
  assert.match(trinnEtikett(250001, sats), /over 250\s?000 kr/);
});

// --- utregningRaderForLinje ------------------------------------------------

test("utregningRaderForLinje: innenfor/ukjent gir ingenting å vise", () => {
  const sats = satserForDato("2026-06-01");
  assert.equal(utregningRaderForLinje(vurder({ type: "purregebyr", belop: 38, tekst: "" }), sats, null), null);
  assert.equal(
    utregningRaderForLinje(
      vurder({ type: "forsinkelsesrente", belop: 100, tekst: "" }),
      sats,
      null,
    ),
    null,
  );
});

test("utregningRaderForLinje: over på salær med kjent hovedstol viser full utregning", () => {
  const sats = satserForDato("2026-06-01");
  const l = vurder({ type: "salaer", belop: 800, tekst: "" }, 2400);
  const rader = utregningRaderForLinje(l, sats, 2400);
  assert.ok(rader);
  assert.deepEqual(
    rader!.map((r) => r.etikett),
    [
      "Hovedstol i brevet",
      "Salærtrinn",
      "Laveste lovlige sats",
      "Høyeste lovlige sats",
      "Krevd i brevet",
      "Over høyeste sats",
    ],
  );
  assert.match(rader![0].verdi, /2\s?400 kr/);
  assert.match(rader![1].verdi, /t\.o\.m\. 2\s?500 kr/);
  assert.match(rader![3].verdi, /750 kr/);
  assert.match(rader![4].verdi, /800 kr/);
  assert.match(rader![5].verdi, /50 kr/);
  assert.equal(rader![5].uthevet, true);
  assert.ok(!rader![4].uthevet);
});

test("utregningRaderForLinje: fast gebyr over viser kun 3 rader", () => {
  const sats = satserForDato("2026-06-01");
  const l = vurder({ type: "purregebyr", belop: 70, tekst: "" });
  const rader = utregningRaderForLinje(l, sats, null);
  assert.deepEqual(
    rader!.map((r) => r.etikett),
    ["Maksimalsats", "Krevd", "Over"],
  );
  assert.equal(rader![2].uthevet, true);
});

test("utregningRaderForLinje: mulig_over har ingen Over-rad, siste er Krevd i brevet", () => {
  const sats = satserForDato("2026-06-01");
  const l = vurder({ type: "salaer", belop: 900, tekst: "" }, 10000);
  assert.equal(l.vurdering, "mulig_over");
  const rader = utregningRaderForLinje(l, sats, 10000);
  assert.deepEqual(
    rader!.map((r) => r.etikett),
    [
      "Hovedstol i brevet",
      "Salærtrinn",
      "Laveste lovlige sats",
      "Høyeste lovlige sats",
      "Krevd i brevet",
    ],
  );
  assert.equal(rader![4].uthevet, true);
});

test("utregningRaderForLinje: manglende hovedstol utelater Hovedstol/Salærtrinn-radene", () => {
  const sats = satserForDato("2026-06-01");
  const l = vurder({ type: "salaer", belop: 900, tekst: "" }, 10000);
  const rader = utregningRaderForLinje(l, sats, null);
  assert.deepEqual(
    rader!.map((r) => r.etikett),
    ["Laveste lovlige sats", "Høyeste lovlige sats", "Krevd i brevet"],
  );
});
