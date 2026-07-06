// Enhetstester for stadium- og fristmotoren. Kjøres med Node sin innebygde
// test-runner: `npm test` (Node 24 stripper TS-typene selv).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STADIER,
  BREVTYPER,
  nesteStadium,
  foreslaStadium,
  fylteSegmenter,
  leggTilDager,
  beregnFrist,
} from "./gjeld.ts";

test("STADIER har riktig eskalerende rekkefølge", () => {
  assert.deepEqual(STADIER.slice(0, 4), [
    "faktura",
    "purring",
    "inkassovarsel",
    "betalingsoppfordring",
  ]);
  assert.equal(STADIER[STADIER.length - 1], "avsluttet");
});

test("nesteStadium går ett steg videre, null på siste", () => {
  assert.equal(nesteStadium("faktura"), "purring");
  assert.equal(nesteStadium("inkassovarsel"), "betalingsoppfordring");
  assert.equal(nesteStadium("avsluttet"), null);
});

test("foreslaStadium: brevtype er stadiet, 'annet' gir null", () => {
  assert.equal(foreslaStadium("inkassovarsel"), "inkassovarsel");
  assert.equal(foreslaStadium("faktura"), "faktura");
  assert.equal(foreslaStadium("annet"), null);
});

test("BREVTYPER inneholder alle stadier pluss 'annet'", () => {
  assert.equal(BREVTYPER.length, STADIER.length + 1);
  assert.ok(BREVTYPER.includes("annet"));
});

test("fylteSegmenter mapper til 1–5", () => {
  assert.equal(fylteSegmenter("faktura"), 1);
  assert.equal(fylteSegmenter("betalingsoppfordring"), 4);
  assert.equal(fylteSegmenter("forliksrad"), 5);
  assert.equal(fylteSegmenter("namsmann"), 5);
  assert.equal(fylteSegmenter("avsluttet"), 5);
});

test("leggTilDager er UTC-trygt over månedsskifte", () => {
  assert.equal(leggTilDager("2026-06-28", 14), "2026-07-12");
  assert.equal(leggTilDager("2026-12-25", 14), "2027-01-08");
  assert.equal(leggTilDager("2024-02-15", 14), "2024-02-29"); // skuddår
});

test("beregnFrist: inkassovarsel gir betalingsfrist +14 dager", () => {
  const f = beregnFrist("inkassovarsel", "2026-06-28");
  assert.deepEqual(f, {
    tittel: "Betalingsfrist",
    forfallsdato: "2026-07-12",
    kilde: "beregnet",
  });
});

test("beregnFrist: betalingsoppfordring gir svarfrist +14 dager", () => {
  const f = beregnFrist("betalingsoppfordring", "2026-06-01");
  assert.deepEqual(f, {
    tittel: "Svarfrist",
    forfallsdato: "2026-06-15",
    kilde: "beregnet",
  });
});

test("beregnFrist: andre brevtyper gir ingen automatisk frist", () => {
  assert.equal(beregnFrist("faktura", "2026-06-01"), null);
  assert.equal(beregnFrist("purring", "2026-06-01"), null);
  assert.equal(beregnFrist("annet", "2026-06-01"), null);
});
