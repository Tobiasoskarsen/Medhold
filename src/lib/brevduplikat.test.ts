import { test } from "node:test";
import assert from "node:assert/strict";

import { erLiktBrev } from "./brevduplikat.ts";

const NORDKAPP = { brevdato: "2026-11-02", belop: 4912.3, saksnummer: "NK-883104" };

test("samme dato, beløp og saksnummer er samme brev", () => {
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP }), true);
  // Saksnummeret skrives ulikt, men er det samme.
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, saksnummer: "nk-883 104" }), true);
});

test("beløpet kan avvike med én øre", () => {
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, belop: 4912.31 }), true);
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, belop: 4912.29 }), true);
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, belop: 4912.32 }), false);
});

test("annen dato eller annet beløp er et nytt brev", () => {
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, brevdato: "2026-11-03" }), false);
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, belop: 5012.3 }), false);
});

test("saksnummer teller bare når begge har ett", () => {
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, saksnummer: "NK-999999" }), false);
  assert.equal(erLiktBrev(NORDKAPP, { ...NORDKAPP, saksnummer: null }), true);
  assert.equal(erLiktBrev({ ...NORDKAPP, saksnummer: "  " }, NORDKAPP), true);
});

test("uten dato eller beløp gjettes det ikke", () => {
  assert.equal(erLiktBrev({ ...NORDKAPP, brevdato: null }, { ...NORDKAPP, brevdato: null }), false);
  assert.equal(erLiktBrev({ ...NORDKAPP, belop: null }, { ...NORDKAPP, belop: null }), false);
  assert.equal(erLiktBrev({ ...NORDKAPP, brevdato: "" }, NORDKAPP), false);
});
