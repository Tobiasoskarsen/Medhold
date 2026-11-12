import { test } from "node:test";
import assert from "node:assert/strict";

import {
  satserForDato,
  sjekkKostnader,
  gebyrFunnTekst,
  trinnEtikett,
  utregningRaderForLinje,
  SATSVERSJONER,
  rettsgebyrSatserFor,
  UKJENT_ARSAK,
  type Kostnadslinje,
} from "./gebyr.ts";
import { idagOslo } from "./dato.ts";

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
  const s = satserForDato("2026-06-01")!;
  assert.equal(s.inkassosats, 750);
  assert.equal(s.purregebyr, 38);
  assert.equal(s.inkassovarselGebyr, 38);
  assert.equal(s.betalingsoppfordringGebyr, 113);
  assert.equal(s.rettsgebyr, 1345);
});

test("satserForDato(null) bruker dagens dato, aldri «nyeste uansett»", () => {
  assert.deepEqual(satserForDato(null), satserForDato(idagOslo()));
});

test("2026-06-01 → 2026-versjonen", () => {
  const s = satserForDato("2026-06-01");
  assert.equal(s?.gyldigFra, "2026-01-01");
  assert.equal(s?.gyldigTil, "2026-12-31");
});

test("grensene er inkluderende: 2026-01-01 og 2026-12-31 → 2026-versjonen", () => {
  assert.equal(satserForDato("2026-01-01")?.gyldigFra, "2026-01-01");
  assert.equal(satserForDato("2026-12-31")?.gyldigFra, "2026-01-01");
});

test("2027-01-15 → null (satsene for 2027 er ikke lagt inn)", () => {
  assert.equal(satserForDato("2027-01-15"), null);
});

test("hver satsversjon har gyldigTil etter gyldigFra", () => {
  for (const v of SATSVERSJONER) assert.ok(v.gyldigFra <= v.gyldigTil);
});

test("brev datert 2027-01-15 → alle linjer ukjent med «Satsene for 2027»", () => {
  const res = sjekkKostnader(
    [
      { type: "purregebyr", belop: 70, tekst: "" },
      { type: "salaer", belop: 2100, tekst: "" },
    ],
    10000,
    "2027-01-15",
  );
  assert.equal(res.satserMangler, true);
  assert.equal(res.antallOver, 0);
  assert.equal(res.antallMuligOver, 0);
  for (const l of res.linjer) {
    assert.equal(l.vurdering, "ukjent");
    assert.equal(
      l.forklaring,
      "Satsene for 2027 er ikke lagt inn ennå, så vi kan ikke vurdere gebyrene.",
    );
  }
});

test("brev datert 2025-12-31 → ukjent med dagens tekst for eldre brev", () => {
  const res = sjekkKostnader(
    [{ type: "purregebyr", belop: 70, tekst: "" }],
    null,
    "2025-12-31",
  );
  assert.equal(res.linjer[0].vurdering, "ukjent");
  assert.equal(
    res.linjer[0].forklaring,
    "Satsene fra brevets tid er ikke lagt inn ennå.",
  );
});

test("brevdato mangler → dagens satser og brevdatoAntatt", () => {
  const res = sjekkKostnader(
    [{ type: "purregebyr", belop: 70, tekst: "" }],
    null,
    null,
  );
  const iDag = sjekkKostnader(
    [{ type: "purregebyr", belop: 70, tekst: "" }],
    null,
    idagOslo(),
  );
  assert.deepEqual(res, { ...iDag, brevdatoAntatt: true });
});

test("brevdato oppgitt → ingen brevdatoAntatt", () => {
  const res = sjekkKostnader([{ type: "purregebyr", belop: 38, tekst: "" }], null, "2026-06-01");
  assert.equal(res.brevdatoAntatt, undefined);
});

// --- Salærtrinn-grenser --------------------------------------------------

test("hovedstol treffer riktig salærtrinn på grensene", () => {
  const s = satserForDato("2026-06-01")!;
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

test("forsinkelsesrente og annet → ukjent (rettsgebyr vurderes etter stadium, se under)", () => {
  assert.equal(vurder({ type: "forsinkelsesrente", belop: 500, tekst: "" }).vurdering, "ukjent");
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
  const sats = satserForDato("2026-06-01")!;
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
  const sats = satserForDato("2026-06-01")!;
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
  const sats = satserForDato("2026-06-01")!;
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
  const sats = satserForDato("2026-06-01")!;
  const l = vurder({ type: "purregebyr", belop: 70, tekst: "" });
  const rader = utregningRaderForLinje(l, sats, null);
  assert.deepEqual(
    rader!.map((r) => r.etikett),
    ["Maksimalsats", "Krevd", "Over"],
  );
  assert.equal(rader![2].uthevet, true);
});

test("utregningRaderForLinje: mulig_over har ingen Over-rad, siste er Krevd i brevet", () => {
  const sats = satserForDato("2026-06-01")!;
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
  const sats = satserForDato("2026-06-01")!;
  const l = vurder({ type: "salaer", belop: 900, tekst: "" }, 10000);
  const rader = utregningRaderForLinje(l, sats, null);
  assert.deepEqual(
    rader!.map((r) => r.etikett),
    ["Laveste lovlige sats", "Høyeste lovlige sats", "Krevd i brevet"],
  );
});

// --- Rettsgebyr (Del A) -----------------------------------------------------

const rett = (belop: number, stadium: string | null, brevdato: string | null = "2026-06-01") =>
  sjekkKostnader([{ type: "rettsgebyr", belop, tekst: "Rettsgebyr" }], null, brevdato, stadium).linjer[0];

test("rettsgebyrsatsene er utledet av R 1 345 og rundet ned (rettsgebyrloven § 6 a)", () => {
  const s = satserForDato("2026-06-01")!;
  assert.equal(s.rettsgebyr, 1345);
  assert.deepEqual(s.rettsgebyrSatser, [
    { navn: "forliksklage", belop: 2071 }, // 1,54 × 1 345 = 2 071,30
    { navn: "begjæring om utlegg", belop: 928 }, // 0,69 × 1 345 = 928,05
    { navn: "begjæring om tvangsfullbyrdelse", belop: 1479 }, // fast beløp, domstol.no
  ]);
  // Avrundingen går ned, aldri opp: 0,69 × 1 400 = 966, 1,54 × 1 000 = 1 540.
  assert.deepEqual(rettsgebyrSatserFor(1400).map((x) => x.belop), [2156, 966]);
  assert.deepEqual(rettsgebyrSatserFor(1000).map((x) => x.belop), [1540, 690]);
});

test("rettsgebyr ved forliksråd: kjent sats er innenfor", () => {
  const r = rett(2071, "forliksrad");
  assert.equal(r.vurdering, "innenfor");
  assert.equal(r.forklaring, "Tilsvarer forliksklage (2 071 kr).");
  assert.equal(rett(928, "namsmann").forklaring, "Tilsvarer begjæring om utlegg (928 kr).");
  assert.equal(rett(1479, "namsmann").vurdering, "innenfor");
});

test("rettsgebyr ved forliksråd: ukjent beløp er ukjent, aldri over", () => {
  const r = rett(2500, "forliksrad");
  assert.equal(r.vurdering, "ukjent");
  assert.equal(r.forklaring, UKJENT_ARSAK.ikkeKjentSats);
  assert.equal(r.differanse, null);
  // Selv et svært høyt beløp gir aldri «over» for rettsgebyr i v1.
  assert.equal(rett(99999, "namsmann").vurdering, "ukjent");
});

test("rettsgebyr før retten er mulig_over, uansett beløp", () => {
  for (const stadium of ["faktura", "purring", "inkassovarsel", "betalingsoppfordring"]) {
    const r = rett(1345, stadium);
    assert.equal(r.vurdering, "mulig_over", stadium);
    assert.equal(r.forklaring, "Rettsgebyr kan først kreves når saken er brakt inn for forliksrådet eller namsmannen.");
  }
  assert.equal(rett(2071, "inkassovarsel").vurdering, "mulig_over");
});

test("rettsgebyr uten kjent stadium er ukjent", () => {
  assert.equal(rett(2071, null).vurdering, "ukjent");
  assert.equal(rett(2071, null).forklaring, UKJENT_ARSAK.manglerStadium);
  // Brevtyper som ikke sier hvor saken står, gir heller ikke en vurdering.
  for (const stadium of ["annet", "nedbetaling", "avsluttet", "tull"]) {
    const r = rett(2071, stadium);
    assert.equal(r.vurdering, "ukjent", stadium);
    assert.equal(r.forklaring, UKJENT_ARSAK.stadiumUklart);
  }
});

test("rettsgebyr: ±1 kr slingring rundt kjent sats, ikke mer", () => {
  assert.equal(rett(2070, "forliksrad").vurdering, "innenfor");
  assert.equal(rett(2072, "forliksrad").vurdering, "innenfor");
  assert.equal(rett(2073, "forliksrad").vurdering, "ukjent");
  assert.equal(rett(2069, "forliksrad").vurdering, "ukjent");
});

test("rettsgebyr: brev uten satsversjon er fortsatt ukjent", () => {
  const gs = sjekkKostnader([{ type: "rettsgebyr", belop: 2071, tekst: "" }], null, "2027-03-01", "forliksrad");
  assert.equal(gs.satserMangler, true);
  assert.equal(gs.linjer[0].vurdering, "ukjent");
  assert.equal(gs.antallOver, 0);
});

test("rettsgebyr gir aldri «over» og teller som mulig_over i resultatet", () => {
  const gs = sjekkKostnader(
    [
      { type: "rettsgebyr", belop: 1345, tekst: "" },
      { type: "rettsgebyr", belop: 99999, tekst: "" },
    ],
    null,
    "2026-06-01",
    "inkassovarsel",
  );
  assert.equal(gs.antallOver, 0);
  assert.equal(gs.antallMuligOver, 2);
  assert.equal(gebyrFunnTekst(gs), "", "rettsgebyr nevnes ikke i funntekst uten «over»");
});

test("rettsgebyr har ingen utregning å vise", () => {
  const sats = satserForDato("2026-06-01")!;
  assert.equal(utregningRaderForLinje(rett(1345, "inkassovarsel"), sats, null), null);
});

test("uten stadium-argument er rettsgebyr ukjent (eldre kall og lagrede resultater)", () => {
  const gs = sjekkKostnader([{ type: "rettsgebyr", belop: 2071, tekst: "" }], null, "2026-06-01");
  assert.equal(gs.linjer[0].vurdering, "ukjent");
});
