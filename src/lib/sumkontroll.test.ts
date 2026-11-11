import { test } from "node:test";
import assert from "node:assert/strict";

import { kontrollerSum, sumavvikFra } from "./sumkontroll.ts";

test("testbrev 13 med riktige tall (1250 + 38 = 1288) → stemmer", () => {
  assert.deepEqual(kontrollerSum(1288, 1250, [{ belop: 38 }]), {
    status: "stemmer",
    sum: 1288,
    total: 1288,
  });
});

test("testbrev 13 med feillest total 289 → avvik", () => {
  const r = kontrollerSum(289, 1250, [{ belop: 38 }]);
  assert.equal(r.status, "avvik");
  if (r.status !== "avvik") return;
  assert.equal(r.sum, 1288);
  assert.equal(r.total, 289);
  assert.equal(r.differanse, -999);
});

test("hovedstol null → ukjent", () => {
  assert.deepEqual(kontrollerSum(1288, null, [{ belop: 38 }]), {
    status: "ukjent",
  });
});

test("total null → ukjent", () => {
  assert.deepEqual(kontrollerSum(null, 1250, []), { status: "ukjent" });
});

test("desimaler: 2 830 + 300 + 113,20 = 3 243,20 → stemmer", () => {
  const r = kontrollerSum(3243.2, 2830, [{ belop: 300 }, { belop: 113.2 }]);
  assert.equal(r.status, "stemmer");
  if (r.status === "stemmer") assert.equal(r.sum, 3243.2);
});

test("desimaler som ikke går opp → avvik med øre-presis differanse", () => {
  const r = kontrollerSum(3243.2, 2830, [{ belop: 300 }]);
  assert.equal(r.status, "avvik");
  if (r.status === "avvik") assert.equal(r.differanse, 113.2);
});

test("differanse på nøyaktig 1 kr → stemmer (avrunding)", () => {
  assert.equal(kontrollerSum(1289, 1250, [{ belop: 38 }]).status, "stemmer");
  assert.equal(kontrollerSum(1287, 1250, [{ belop: 38 }]).status, "stemmer");
});

test("differanse på 1,01 kr → avvik", () => {
  assert.equal(kontrollerSum(1289.01, 1250, [{ belop: 38 }]).status, "avvik");
});

test("ingen kostnadslinjer: total = hovedstol → stemmer", () => {
  assert.equal(kontrollerSum(500, 500, []).status, "stemmer");
});

// --- sumavvikFra (Del B.1) -----------------------------------------------

const lagret = (sumkontroll: unknown) => ({ satsGyldigFra: "2026-01-01", linjer: [], antallOver: 0, antallMuligOver: 0, sumkontroll });

test("testbrev 38: brevet krever 100 kr mer enn linjene blir", () => {
  const sk = kontrollerSum(4912.3, 4512.3, [{ belop: 300 }]);
  assert.deepEqual(sumavvikFra(lagret({ ...sk, bekreftetLikevel: true })), { sum: 4812.3, total: 4912.3, differanse: 100 });
});

test("stemmer, ukjent og innenfor slingringen gir null", () => {
  assert.equal(sumavvikFra(lagret({ status: "stemmer", sum: 100, total: 100 })), null);
  assert.equal(sumavvikFra(lagret({ status: "ukjent" })), null);
  assert.equal(sumavvikFra(lagret({ status: "avvik", sum: 100, total: 101, differanse: 1 })), null);
});

test("linjene blir mer enn totalen: ikke et funn", () => {
  assert.equal(sumavvikFra(lagret({ status: "avvik", sum: 1288, total: 289, differanse: -999 })), null);
});

test("gammel rad uten sumkontroll og ugyldig form gir null", () => {
  assert.equal(sumavvikFra(lagret(undefined)), null);
  assert.equal(sumavvikFra({ satsGyldigFra: "2026-01-01", linjer: [] }), null);
  assert.equal(sumavvikFra(null), null);
  assert.equal(sumavvikFra("avvik"), null);
  assert.equal(sumavvikFra(lagret({ status: "avvik", sum: "4812,30", total: 4912.3 })), null);
  assert.equal(sumavvikFra(lagret({ status: "avvik", sum: Number.NaN, total: 4912.3 })), null);
  assert.equal(sumavvikFra(lagret("avvik")), null);
});
