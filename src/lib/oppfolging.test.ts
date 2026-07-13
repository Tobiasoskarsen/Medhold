import { test } from "node:test";
import assert from "node:assert/strict";

import { oppfolgingsKandidater, type VenterSak } from "./oppfolging.ts";

const NAA = new Date("2026-07-20T12:00:00Z");

function sak(id: string, dagerSiden: number): VenterSak {
  const t = new Date(NAA.getTime() - dagerSiden * 86_400_000).toISOString();
  return { sakId: id, brukerId: "u", kreditor: "Kredinor", sisteAktivitet: t };
}

test("14+ dager siden aktivitet er kandidat", () => {
  const res = oppfolgingsKandidater([sak("a", 14)], new Set(), NAA);
  assert.deepEqual(
    res.map((s) => s.sakId),
    ["a"],
  );
});

test("under 14 dager er ikke kandidat", () => {
  const res = oppfolgingsKandidater([sak("a", 13)], new Set(), NAA);
  assert.equal(res.length, 0);
});

test("allerede fulgt opp ekskluderes", () => {
  const res = oppfolgingsKandidater([sak("a", 30)], new Set(["a"]), NAA);
  assert.equal(res.length, 0);
});

test("ny aktivitet (nylig brev) ekskluderer saken", () => {
  // Saken har fått nytt brev nylig → sisteAktivitet er fersk → ikke kandidat.
  const res = oppfolgingsKandidater([sak("a", 2)], new Set(), NAA);
  assert.equal(res.length, 0);
});

test("blander flere saker riktig", () => {
  const res = oppfolgingsKandidater(
    [sak("gammel", 20), sak("fersk", 5), sak("fulgt", 40)],
    new Set(["fulgt"]),
    NAA,
  );
  assert.deepEqual(
    res.map((s) => s.sakId),
    ["gammel"],
  );
});
