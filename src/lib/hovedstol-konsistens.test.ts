import { test } from "node:test";
import assert from "node:assert/strict";

import { finnHovedstolAvvik, type HovedstolBrevInput } from "./hovedstol-konsistens.ts";

function brev(
  id: string,
  brevdato: string | null,
  hovedstol: number | null,
  opprettet = "2026-01-01T00:00:00Z",
): HovedstolBrevInput {
  return { id, brevdato, belop_hovedstol: hovedstol, opprettet };
}

test("to brev med samme hovedstol gir ingen avvik", () => {
  const res = finnHovedstolAvvik([
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", 5000),
  ]);
  assert.equal(res.length, 0);
});

test("to brev med ulik hovedstol gir ett avvik med riktige tall", () => {
  const res = finnHovedstolAvvik([
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", 6500),
  ]);
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], {
    brevId: "b",
    brevdato: "2026-02-01",
    hovedstol: 6500,
    forrigeHovedstol: 5000,
    forrigeBrevId: "a",
  });
});

test("tre brev der kun ett par avviker", () => {
  const res = finnHovedstolAvvik([
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", 5000),
    brev("c", "2026-03-01", 7000),
  ]);
  assert.equal(res.length, 1);
  assert.equal(res[0].forrigeBrevId, "b");
  assert.equal(res[0].brevId, "c");
  assert.equal(res[0].forrigeHovedstol, 5000);
  assert.equal(res[0].hovedstol, 7000);
});

test("flere avvik i samme sak returnerer ett per overgang", () => {
  const res = finnHovedstolAvvik([
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", 6000),
    brev("c", "2026-03-01", 7000),
  ]);
  assert.equal(res.length, 2);
  assert.deepEqual(
    res.map((a) => [a.forrigeBrevId, a.brevId]),
    [
      ["a", "b"],
      ["b", "c"],
    ],
  );
});

test("brev med null hovedstol hoppes over — sammenligner nærmeste forrige med verdi", () => {
  const res = finnHovedstolAvvik([
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", null),
    brev("c", "2026-03-01", 5000),
  ]);
  assert.equal(res.length, 0);
});

test("brev med null hovedstol hoppet over, men avvik oppdages likevel mot nærmeste forrige", () => {
  const res = finnHovedstolAvvik([
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", null),
    brev("c", "2026-03-01", 8000),
  ]);
  assert.equal(res.length, 1);
  assert.equal(res[0].forrigeBrevId, "a");
  assert.equal(res[0].brevId, "c");
});

test("under 2 brev med hovedstol gir tom liste", () => {
  assert.equal(finnHovedstolAvvik([brev("a", "2026-01-01", 5000)]).length, 0);
  assert.equal(finnHovedstolAvvik([]).length, 0);
  assert.equal(
    finnHovedstolAvvik([
      brev("a", "2026-01-01", 5000),
      brev("b", "2026-02-01", null),
    ]).length,
    0,
  );
});

test("udatert brev sorteres etter alle daterte brev", () => {
  const res = finnHovedstolAvvik([
    brev("udatert", null, 9000, "2026-01-15T00:00:00Z"),
    brev("a", "2026-01-01", 5000),
    brev("b", "2026-02-01", 5000),
  ]);
  // Kronologisk rekkefølge: a (dato) → b (dato) → udatert (ingen dato, sist).
  assert.equal(res.length, 1);
  assert.equal(res[0].forrigeBrevId, "b");
  assert.equal(res[0].brevId, "udatert");
});

test("to udaterte brev sorteres på opprettet-tidsstempel", () => {
  const res = finnHovedstolAvvik([
    brev("nyest", null, 8000, "2026-03-01T00:00:00Z"),
    brev("eldst", null, 5000, "2026-01-01T00:00:00Z"),
  ]);
  assert.equal(res.length, 1);
  assert.equal(res[0].forrigeBrevId, "eldst");
  assert.equal(res[0].brevId, "nyest");
});
