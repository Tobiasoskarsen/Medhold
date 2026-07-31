import { test } from "node:test";
import assert from "node:assert/strict";

import { finnFraser, fraseRegex } from "./tekstsok.ts";

test("finner et enkelt treff", () => {
  assert.deepEqual(finnFraser("Jeg viser til brevet", ["viser til"]), [
    "viser til",
  ]);
});

test("finner flere ord/fraser i samme tekst", () => {
  const res = finnFraser("Jeg anmoder herved om at dere venter.", [
    "anmoder",
    "herved",
    "ikke i teksten",
  ]);
  assert.deepEqual(res, ["anmoder", "herved"]);
});

test("case-insensitivt", () => {
  assert.deepEqual(finnFraser("HERVED bekreftes", ["herved"]), ["herved"]);
});

test("ordgrense: unngår falskt treff i lengre ord", () => {
  assert.deepEqual(finnFraser("Kravet står i bero.", ["bero"]), ["bero"]);
  assert.deepEqual(finnFraser("Situasjonen er beroende på svar.", ["bero"]), []);
});

test("tom tekst gir ingen treff", () => {
  assert.deepEqual(finnFraser("", ["herved", "anmoder"]), []);
});

test("ingen av fraser finnes gir tom liste", () => {
  assert.deepEqual(finnFraser("En helt vanlig tekst.", ["konkurs"]), []);
});

test("fraseRegex bygger en ordgrense- og æøå-bevisst regex", () => {
  const re = fraseRegex("på bakgrunn av dette");
  assert.ok(re.test("På bakgrunn av dette avslår vi."));
  assert.ok(!re.test("bakgrunnen"));
});
