import { test } from "node:test";
import assert from "node:assert/strict";

import {
  oppfolgingsKandidater,
  dagerTilOppfolging,
  oppfolgingTilstand,
  type VenterSak,
} from "./oppfolging.ts";

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

// --- dagerTilOppfolging ----------------------------------------------------

function isoDagerSiden(dager: number): string {
  return new Date(NAA.getTime() - dager * 86_400_000).toISOString();
}

test("dagerTilOppfolging: fersk aktivitet gir full grense igjen", () => {
  assert.equal(dagerTilOppfolging(isoDagerSiden(0), NAA), 14);
});

test("dagerTilOppfolging: teller ned dag for dag", () => {
  assert.equal(dagerTilOppfolging(isoDagerSiden(5), NAA), 9);
  assert.equal(dagerTilOppfolging(isoDagerSiden(13), NAA), 1);
});

test("dagerTilOppfolging: nøyaktig 14 dager gir 0 (i dag)", () => {
  assert.equal(dagerTilOppfolging(isoDagerSiden(14), NAA), 0);
});

test("dagerTilOppfolging: over grensen gir negativt tall (overskredet)", () => {
  assert.equal(dagerTilOppfolging(isoDagerSiden(15), NAA), -1);
  assert.equal(dagerTilOppfolging(isoDagerSiden(20), NAA), -6);
});

test("dagerTilOppfolging: samme grense som oppfolgingsKandidater sin 14-dagers-sjekk", () => {
  // Idet oppfolgingsKandidater regner saken som moden (>=14 dager), skal
  // dagerTilOppfolging ha krysset ned til 0 eller lavere — samme konstant,
  // ingen avvik mellom de to.
  const kandidat = oppfolgingsKandidater([sak("a", 14)], new Set(), NAA);
  assert.equal(kandidat.length, 1);
  assert.ok(dagerTilOppfolging(isoDagerSiden(14), NAA) <= 0);
});

// --- oppfolgingTilstand -----------------------------------------------------

test("oppfolgingTilstand: positivt tall gir 'kommer' med riktig dagtall", () => {
  assert.deepEqual(oppfolgingTilstand(5, false), { type: "kommer", dager: 5 });
});

test("oppfolgingTilstand: 0 gir 'i_dag'", () => {
  assert.deepEqual(oppfolgingTilstand(0, false), { type: "i_dag" });
});

test("oppfolgingTilstand: negativt + registrert oppfølging gir 'sendt'", () => {
  assert.deepEqual(oppfolgingTilstand(-2, true), { type: "sendt" });
});

test("oppfolgingTilstand: negativt uten registrert oppfølging gir 'na'", () => {
  assert.deepEqual(oppfolgingTilstand(-2, false), { type: "na" });
});
