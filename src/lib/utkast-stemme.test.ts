import { test } from "node:test";
import assert from "node:assert/strict";

import { finnForbudteOrd, FORBUDTE_ORD } from "./utkast-stemme.ts";

test("treff: enkeltord finnes", () => {
  assert.deepEqual(
    finnForbudteOrd("Jeg viser til deres brev vedrørende kravet."),
    ["vedrørende", "viser til"],
  );
});

test("treff: flerords-frase finnes", () => {
  assert.deepEqual(finnForbudteOrd("Kravet settes i bero til videre."), [
    "i bero",
  ]);
});

test("treff: alle ord i listen kan gjenfinnes enkeltvis", () => {
  for (const ord of FORBUDTE_ORD) {
    assert.deepEqual(
      finnForbudteOrd(`Dette er en test med ordet ${ord} i midten.`),
      [ord],
      `fant ikke «${ord}»`,
    );
  }
});

test("ikke-treff: ren tekst uten forbudte ord", () => {
  assert.deepEqual(
    finnForbudteOrd("Jeg har mottatt brevet og betaler kravet innen fristen."),
    [],
  );
});

test("ordgrense: «beroende» gir ikke falskt treff på «i bero»", () => {
  assert.deepEqual(finnForbudteOrd("Saken er nå i beroende tilstand."), []);
});

test("ordgrense: «anmoderen» gir ikke falskt treff på «anmoder»", () => {
  assert.deepEqual(finnForbudteOrd("Anmoderen tok kontakt i går."), []);
});

test("ordgrense: «erlegges» gir ikke falskt treff på «erlegge»", () => {
  assert.deepEqual(finnForbudteOrd("Beløpet erlegges innen fristen."), []);
});

test("store/små bokstaver: treff uavhengig av kasus", () => {
  assert.deepEqual(finnForbudteOrd("VEDRØRENDE deres krav."), ["vedrørende"]);
  assert.deepEqual(finnForbudteOrd("Anmodning om utsettelse."), [
    "anmodning",
  ]);
});

test("«viser til» som frase, ikke som løsrevne ord", () => {
  assert.deepEqual(finnForbudteOrd("Jeg har vist til brevet tidligere."), []);
  assert.deepEqual(finnForbudteOrd("Jeg viser til brevet."), ["viser til"]);
});

test("flere ulike treff i samme tekst rapporteres alle", () => {
  const treff = finnForbudteOrd(
    "Undertegnede imøteser svar vedrørende kravet, jf. ovennevnte.",
  );
  assert.deepEqual(treff.sort(), [
    "imøteser",
    "ovennevnte",
    "undertegnede",
    "vedrørende",
  ]);
});

test("tom tekst gir ingen treff", () => {
  assert.deepEqual(finnForbudteOrd(""), []);
});
