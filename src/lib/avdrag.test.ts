import { test } from "node:test";
import assert from "node:assert/strict";

import { beregnAvdrag } from "./avdrag.ts";

test("akseptansekriterium: 3243 kr og 500 kr/mnd → 7 mnd, siste 243", () => {
  assert.deepEqual(beregnAvdrag(3243, 500), {
    manedsbelop: 500,
    antallMandeder: 7,
    sisteAvdrag: 243,
  });
});

test("avrunding opp av antall måneder", () => {
  assert.deepEqual(beregnAvdrag(1000, 300), {
    manedsbelop: 300,
    antallMandeder: 4,
    sisteAvdrag: 100,
  });
});

test("siste avdrag = månedsbeløp når det går opp jevnt", () => {
  assert.deepEqual(beregnAvdrag(1000, 250), {
    manedsbelop: 250,
    antallMandeder: 4,
    sisteAvdrag: 250,
  });
});

test("clamp: månedsbeløp under 1 kr → 1 kr", () => {
  assert.deepEqual(beregnAvdrag(3243, 0), {
    manedsbelop: 1,
    antallMandeder: 3243,
    sisteAvdrag: 1,
  });
});

test("clamp: månedsbeløp = total → én måned", () => {
  assert.deepEqual(beregnAvdrag(3243, 3243), {
    manedsbelop: 3243,
    antallMandeder: 1,
    sisteAvdrag: 3243,
  });
});

test("clamp: månedsbeløp over total → én måned", () => {
  assert.deepEqual(beregnAvdrag(3243, 3244), {
    manedsbelop: 3243,
    antallMandeder: 1,
    sisteAvdrag: 3243,
  });
});

test("lang avtale (> 12 mnd) gir riktig antall måneder for merknaden", () => {
  const r = beregnAvdrag(13000, 1000);
  assert.equal(r.antallMandeder, 13);
  assert.ok(r.antallMandeder > 12);
  assert.equal(r.sisteAvdrag, 1000);
});

test("total 0 → tomt forslag", () => {
  assert.deepEqual(beregnAvdrag(0, 500), {
    manedsbelop: 0,
    antallMandeder: 0,
    sisteAvdrag: 0,
  });
});
