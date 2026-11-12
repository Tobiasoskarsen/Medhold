import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RENTEPERIODER,
  erIsoDato,
  forventetRente,
  hoyesteSats,
  normaliserRentefelt,
  renteSegmenter,
  tolkSats,
} from "./rente.ts";

test("tabellen er sammenhengende halvår fra 2020 til og med 2026, med kilde", () => {
  assert.equal(RENTEPERIODER[0].fra, "2020-01-01");
  assert.equal(RENTEPERIODER.at(-1)!.til, "2026-12-31");
  for (let i = 1; i < RENTEPERIODER.length; i++) {
    const forrige = new Date(`${RENTEPERIODER[i - 1].til}T00:00:00Z`).getTime() + 86_400_000;
    assert.equal(new Date(forrige).toISOString().slice(0, 10), RENTEPERIODER[i].fra, "ingen hull eller overlapp");
  }
  for (const p of RENTEPERIODER) assert.match(p.kilde, /^https:\/\/www\.finanstilsynet\.no\//);
});

test("satsene 2024–2026 er de verifiserte", () => {
  const sats = (dato: string) => hoyesteSats(dato, dato);
  assert.equal(sats("2024-03-01"), 12.5);
  assert.equal(sats("2025-03-01"), 12.5);
  assert.equal(sats("2025-09-01"), 12.25);
  assert.equal(sats("2026-03-01"), 12);
  assert.equal(sats("2026-09-01"), 12.25);
  assert.equal(sats("2023-09-01"), 11.75);
  assert.equal(sats("2022-03-01"), 8.5);
});

test("3 000 kr, 2026-09-01 → 2026-10-28: 58 dager à 12,25 % gir 58,40 kr", () => {
  const seg = renteSegmenter(3000, "2026-09-01", "2026-10-28")!;
  assert.equal(seg.length, 1);
  assert.equal(seg[0].dager, 58);
  assert.equal(seg[0].arsdager, 365);
  assert.equal(forventetRente(3000, "2026-09-01", "2026-10-28"), 58.4);
});

test("10 000 kr over halvårsskiftet: 61 dager à 12,00 % + 31 dager à 12,25 % gir 304,59 kr", () => {
  const seg = renteSegmenter(10000, "2026-05-01", "2026-07-31")!;
  assert.deepEqual(seg.map((s) => [s.dager, s.sats]), [[61, 12], [31, 12.25]]);
  assert.equal(forventetRente(10000, "2026-05-01", "2026-07-31"), 304.59);
  assert.equal(hoyesteSats("2026-05-01", "2026-07-31"), 12.25);
});

test("perioden begge ender inkludert: én dag gir én dag", () => {
  assert.equal(renteSegmenter(36500, "2026-03-01", "2026-03-01")![0].dager, 1);
  assert.equal(forventetRente(36500, "2026-03-01", "2026-03-01"), 12.0); // 36 500 × 12 % / 365
});

test("periode som krysser nyttår og skuddår", () => {
  // 2023-12-15 → 2024-01-15: 17 dager à 11,75 % (2023) og 15 dager à 12,5 % (2024, skuddår: 366).
  const seg = renteSegmenter(20000, "2023-12-15", "2024-01-15")!;
  assert.deepEqual(seg.map((s) => [s.dager, s.arsdager, s.sats]), [[17, 365, 11.75], [15, 366, 12.5]]);
  const forventet = (20000 * 11.75 * 17) / (100 * 365) + (20000 * 12.5 * 15) / (100 * 366);
  assert.equal(forventetRente(20000, "2023-12-15", "2024-01-15"), Math.round(forventet * 100) / 100);
  // Hele skuddåret 2024 deles i to halvår, begge med 366 årsdager.
  const aar = renteSegmenter(10000, "2024-01-01", "2024-12-31")!;
  assert.deepEqual(aar.map((s) => [s.dager, s.arsdager]), [[182, 366], [184, 366]]);
});

test("perioden utenfor tabellen gir null, aldri nærmeste sats", () => {
  assert.equal(forventetRente(3000, "2027-01-01", "2027-02-01"), null);
  assert.equal(hoyesteSats("2027-01-01", "2027-02-01"), null);
  assert.equal(forventetRente(3000, "2019-12-01", "2020-01-31"), null);
  // Delvis dekket er også null: 2026-12-15 → 2027-01-10.
  assert.equal(forventetRente(3000, "2026-12-15", "2027-01-10"), null);
  assert.equal(hoyesteSats("2026-12-15", "2027-01-10"), null);
});

test("ugyldige inndata gir null", () => {
  assert.equal(forventetRente(3000, "2026-10-28", "2026-09-01"), null, "fra etter til");
  assert.equal(forventetRente(3000, "2026-02-30", "2026-03-10"), null, "ugyldig dato");
  assert.equal(forventetRente(3000, "1.9.2026", "2026-10-28"), null, "feil format");
  assert.equal(forventetRente(-1, "2026-09-01", "2026-10-28"), null, "negativ hovedstol");
  assert.equal(forventetRente(Number.NaN, "2026-09-01", "2026-10-28"), null);
});

test("erIsoDato godtar bare ekte kalenderdatoer", () => {
  assert.equal(erIsoDato("2026-02-28"), true);
  assert.equal(erIsoDato("2024-02-29"), true);
  assert.equal(erIsoDato("2026-02-29"), false);
  assert.equal(erIsoDato("2026-13-01"), false);
  assert.equal(erIsoDato(""), false);
  assert.equal(erIsoDato(null), false);
});

test("tolkSats: norsk og internasjonalt format, ugyldig og utenfor 0–40 gir null", () => {
  assert.equal(tolkSats("12,25"), 12.25);
  assert.equal(tolkSats("12.25 %"), 12.25);
  assert.equal(tolkSats(12.25), 12.25);
  assert.equal(tolkSats("0"), 0);
  assert.equal(tolkSats("40"), 40);
  assert.equal(tolkSats("40,01"), null);
  assert.equal(tolkSats("-3"), null);
  assert.equal(tolkSats(""), null);
  assert.equal(tolkSats("tolv"), null);
  assert.equal(tolkSats(null), null);
});

test("normaliserRentefelt: ugyldig dato og sats fjernes, andre typer mister feltene", () => {
  const linje = { type: "forsinkelsesrente", belop: 58.4, tekst: "Rente", renteFra: "2026-09-01", renteTil: "2026-02-30", rentesats: 12.25 };
  assert.deepEqual(normaliserRentefelt(linje), { type: "forsinkelsesrente", belop: 58.4, tekst: "Rente", renteFra: "2026-09-01", rentesats: 12.25 });
  assert.deepEqual(
    normaliserRentefelt({ ...linje, renteFra: "", renteTil: "x", rentesats: 55 }),
    { type: "forsinkelsesrente", belop: 58.4, tekst: "Rente" },
  );
  assert.deepEqual(
    normaliserRentefelt({ type: "purregebyr", belop: 38, tekst: "Purring", renteFra: "2026-09-01", renteTil: "2026-10-01", rentesats: 12 }),
    { type: "purregebyr", belop: 38, tekst: "Purring" },
  );
  assert.deepEqual(normaliserRentefelt({ type: "forsinkelsesrente", belop: 1, tekst: "" }), { type: "forsinkelsesrente", belop: 1, tekst: "" });
});
