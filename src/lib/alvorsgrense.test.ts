import { test } from "node:test";
import assert from "node:assert/strict";

import { erAlvorligSak, ALVORLIGE_SIGNALER } from "./alvorsgrense.ts";

test("hvert signalord i listen trigger erAlvorligSak", () => {
  for (const signal of ALVORLIGE_SIGNALER) {
    assert.equal(
      erAlvorligSak(`Brevet nevner ${signal} i denne saken.`),
      true,
      `forventet treff på "${signal}"`,
    );
  }
});

test("case-insensitivt", () => {
  assert.equal(erAlvorligSak("Dette gjelder TVANGSSALG av boligen."), true);
});

test("ordgrense unngår falske treff i lengre ord", () => {
  // "tvangssalg" skal ikke trigges av et lengre, ubeslektet ord som
  // inneholder samme tegnfølge etterfulgt av bokstaver.
  assert.equal(erAlvorligSak("tvangssalgsprosessens regler"), false);
});

test("tom tekst gir ingen treff", () => {
  assert.equal(erAlvorligSak(""), false);
});

test("vanlig inkassobrev uten alvorlige signaler gir false", () => {
  const tekst =
    "Vi viser til tidligere purring. Betal kravet innen fristen, ellers går saken til inkasso.";
  assert.equal(erAlvorligSak(tekst), false);
});

test("ett treff er nok, selv med resten av teksten uskyldig", () => {
  const tekst =
    "Dette er et vanlig inkassovarsel. Dersom kravet ikke gjøres opp, vurderer vi konkursbegjæring.";
  assert.equal(erAlvorligSak(tekst), true);
});
