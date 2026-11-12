import { test } from "node:test";
import assert from "node:assert/strict";

import { initialerFra, tintFor, TINT_KLASSE } from "./tint.ts";

test("samme navn gir alltid samme tint, uavhengig av store bokstaver og mellomrom", () => {
  for (const n of ["Fjelltopp Inkasso", "Nordkapp Inkasso AS", "Bølgen Kreditt", "Skogbrukets Finans"]) {
    assert.equal(tintFor(n), tintFor(n));
    assert.equal(tintFor(n), tintFor(`  ${n.toUpperCase()}  `));
  }
  assert.equal(tintFor("Nordkapp   Inkasso AS"), tintFor("nordkapp inkasso as"));
});

test("tinten er alltid 1–4, og alle fire brukes av et vanlig utvalg navn", () => {
  const navn = [
    "Fjelltopp Inkasso", "Nordkapp Inkasso AS", "Bølgen Kreditt", "Skogbrukets Finans",
    "Kredinor", "Intrum", "Lindorff", "Testkreditor Inkasso AS", "Testbutikken AS",
    "Mylift", "Pulsløft Treningssenter AS", "Strømmeriket AS", "Aksjonen AS", "Gjensidige",
  ];
  const brukt = new Set(navn.map(tintFor));
  for (const t of brukt) assert.ok([1, 2, 3, 4].includes(t));
  assert.equal(brukt.size, 4, "alle fire tinter blir brukt");
  for (const t of [1, 2, 3, 4] as const) assert.match(TINT_KLASSE[t], new RegExp(`bg-tint-${t}-bg text-tint-${t}-tekst`));
});

test("tom streng gir en gyldig tint", () => {
  assert.ok([1, 2, 3, 4].includes(tintFor("")));
});

test("initialer: to ord, ett ord, e-post og ingenting", () => {
  assert.equal(initialerFra("Tobias Oskarsen"), "TO");
  assert.equal(initialerFra("  tobias   oskarsen  "), "TO");
  assert.equal(initialerFra("Tobias Eirik Oskarsen"), "TE");
  assert.equal(initialerFra("Kari"), "K");
  assert.equal(initialerFra("øystein"), "Ø");
  assert.equal(initialerFra("", "kari@example.com"), "K");
  assert.equal(initialerFra(null, null), "M");
});
