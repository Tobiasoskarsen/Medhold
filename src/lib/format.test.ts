import { test } from "node:test";
import assert from "node:assert/strict";

import { formaterBelop, tolkKr } from "./format.ts";

test("formaterBelop: norsk tusenskille, ingen desimaler", () => {
  // Intl.NumberFormat("nb-NO") bruker hardt mellomrom (U+00A0), ikke vanlig.
  assert.equal(formaterBelop(3243), "3 243");
  assert.equal(formaterBelop(500), "500");
  assert.equal(formaterBelop(null), null);
  assert.equal(formaterBelop(undefined), null);
});

test("tolkKr: internasjonalt format med punktum som desimaltegn (regresjonstest)", () => {
  // Dette er nøyaktig scenariet som feilet: «3201.80» ble tolket som 320180.
  assert.equal(tolkKr("3201.80"), 3201.8);
});

test("tolkKr: norsk format med komma som desimaltegn", () => {
  assert.equal(tolkKr("3201,80"), 3201.8);
});

test("tolkKr: norsk format med mellomrom som tusenskille og komma som desimal", () => {
  assert.equal(tolkKr("3 201,80"), 3201.8);
});

test("tolkKr: fullt norsk format med punktum som tusenskille og komma som desimal", () => {
  assert.equal(tolkKr("3.201,80"), 3201.8);
});

test("tolkKr: hele kroner uten øre", () => {
  assert.equal(tolkKr("3201"), 3201);
  assert.equal(tolkKr("3 201"), 3201);
});

test("tolkKr: punktum som tusenskille uten desimaler (3+ sifre etter siste punktum)", () => {
  assert.equal(tolkKr("1.234"), 1234);
});

test("tolkKr: «kr»-suffiks fjernes", () => {
  assert.equal(tolkKr("3201,80 kr"), 3201.8);
  assert.equal(tolkKr("3201 kr."), 3201);
});

test("tolkKr: tom eller manglende streng gir null", () => {
  assert.equal(tolkKr(""), null);
  assert.equal(tolkKr("   "), null);
  assert.equal(tolkKr(null), null);
  assert.equal(tolkKr(undefined), null);
});

test("tolkKr: ugyldig tekst gir null", () => {
  assert.equal(tolkKr("ukjent"), null);
});

test("tolkKr: étt siffer øre", () => {
  assert.equal(tolkKr("100,5"), 100.5);
});
