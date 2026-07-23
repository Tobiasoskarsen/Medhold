import { test } from "node:test";
import assert from "node:assert/strict";

import { anbefalVei, type VeivalgSvar } from "./veivalg.ts";

// Åtte relevante kombinasjoner (ja/nei-sannhetstabell — «vet ikke» oppfører
// seg som «nei» for bestilt/belopStemmer, dekket separat under).
const tabell: [VeivalgSvar, "svar" | "betale"][] = [
  [{ bestilt: "ja", tidligereHandlet: "nei", belopStemmer: "ja" }, "betale"],
  [{ bestilt: "ja", tidligereHandlet: "nei", belopStemmer: "nei" }, "svar"],
  [{ bestilt: "ja", tidligereHandlet: "ja", belopStemmer: "ja" }, "svar"],
  [{ bestilt: "ja", tidligereHandlet: "ja", belopStemmer: "nei" }, "svar"],
  [{ bestilt: "nei", tidligereHandlet: "nei", belopStemmer: "ja" }, "svar"],
  [{ bestilt: "nei", tidligereHandlet: "nei", belopStemmer: "nei" }, "svar"],
  [{ bestilt: "nei", tidligereHandlet: "ja", belopStemmer: "ja" }, "svar"],
  [{ bestilt: "nei", tidligereHandlet: "ja", belopStemmer: "nei" }, "svar"],
];

for (const [svar, forventet] of tabell) {
  test(`bestilt=${svar.bestilt} tidligereHandlet=${svar.tidligereHandlet} belopStemmer=${svar.belopStemmer} → ${forventet}`, () => {
    assert.equal(anbefalVei(svar), forventet);
  });
}

test("«vet ikke» på bestilt gir svar, selv om alt annet er positivt", () => {
  assert.equal(
    anbefalVei({ bestilt: "vet_ikke", tidligereHandlet: "nei", belopStemmer: "ja" }),
    "svar",
  );
});

test("«vet ikke» på belopStemmer gir svar, selv om alt annet er positivt", () => {
  assert.equal(
    anbefalVei({ bestilt: "ja", tidligereHandlet: "nei", belopStemmer: "vet_ikke" }),
    "svar",
  );
});

test("eneste vei til «betale»: bestilt ja, ikke tidligere handlet, beløp stemmer", () => {
  assert.equal(
    anbefalVei({ bestilt: "ja", tidligereHandlet: "nei", belopStemmer: "ja" }),
    "betale",
  );
});
