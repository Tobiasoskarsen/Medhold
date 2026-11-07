import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fristKlasse,
  kanViseSeier,
  rangerSaker,
  relevantFrist,
  sisteBrevPerSak,
  skalVarsles,
  velgViktigsteSak,
} from "./prioritet.ts";

const idag = "2026-11-10";

const sak = (id: string, status: "aktiv" | "venter_pa_svar" | "fullfort" = "aktiv", belop = 0) => ({
  id,
  status,
  belop_totalt: belop,
});
const frist = (sak_id: string, forfallsdato: string, brev_id: string | null = null) => ({
  sak_id,
  brev_id,
  forfallsdato,
});
const brev = (id: string, sak_id: string, brevdato: string | null, alvorlig = false, opprettet = `${brevdato ?? "2026-11-01"}T10:00:00Z`) => ({
  id,
  sak_id,
  brevdato,
  opprettet,
  alvorlig,
});

test("frist i morgen slår en gammel utløpt frist fra et gammelt brev", () => {
  const r = velgViktigsteSak(
    [sak("gammel"), sak("ny")],
    [frist("gammel", "2026-06-01", "b1"), frist("ny", "2026-11-11", "b2")],
    [brev("b1", "gammel", "2026-05-18"), brev("b2", "ny", "2026-11-05")],
    idag,
  );
  assert.equal(r?.sak.id, "ny");
  assert.equal(r?.grunn, "frist_snart");
});

test("frist som gikk ut for lenge siden er historikk, også på et nyere brev", () => {
  const b = [brev("b1", "s", "2026-10-01")];
  assert.equal(fristKlasse(frist("s", "2026-10-15", "b1"), b, idag), "historikk");
  assert.equal(fristKlasse(frist("s", "2026-11-05", "b1"), b, idag), "utlopt");
});

test("alvorlig sak med senere betalingsfrist går foran", () => {
  const r = velgViktigsteSak(
    [sak("vanlig"), sak("alvorlig")],
    [frist("vanlig", "2026-11-11", "b1"), frist("alvorlig", "2026-12-20", "b2")],
    [brev("b1", "vanlig", "2026-11-01"), brev("b2", "alvorlig", "2026-11-05", true)],
    idag,
  );
  assert.equal(r?.sak.id, "alvorlig");
  assert.equal(r?.alvorlig, true);
  assert.equal(r?.frist?.forfallsdato, "2026-12-20");
});

test("alvorlig brev over 45 dager gammelt gir ikke forrang", () => {
  const r = velgViktigsteSak(
    [sak("gammelt"), sak("frist")],
    [frist("frist", "2026-11-11", "b2")],
    [brev("b1", "gammelt", "2026-08-01", true), brev("b2", "frist", "2026-11-01")],
    idag,
  );
  assert.equal(r?.sak.id, "frist");
});

test("alvorlighet følger sakens nyeste brev etter brevdato", () => {
  const r = rangerSaker(
    [sak("s")],
    [],
    [
      brev("gammel", "s", "2026-10-01", true, "2026-11-08T10:00:00Z"),
      brev("ny", "s", "2026-11-01", false, "2026-11-02T10:00:00Z"),
    ],
    idag,
  );
  assert.equal(r[0].alvorlig, false);
});

test("alvorlig sak som venter på svar går også foran", () => {
  const r = velgViktigsteSak(
    [sak("frist"), sak("venter", "venter_pa_svar")],
    [frist("frist", "2026-11-11")],
    [brev("b", "venter", "2026-11-05", true)],
    idag,
  );
  assert.equal(r?.sak.id, "venter");
});

test("rekkefølgen er snart, nylig utløpt, senere, uten frist, historikk, venter", () => {
  const b = [brev("b1", "historikk", "2026-05-01")];
  const r = rangerSaker(
    [
      sak("venter", "venter_pa_svar"),
      sak("historikk"),
      sak("uten"),
      sak("senere"),
      sak("utlopt"),
      sak("snart"),
    ],
    [
      frist("historikk", "2026-05-15", "b1"),
      frist("senere", "2026-11-30"),
      frist("utlopt", "2026-11-08"),
      frist("snart", "2026-11-12"),
    ],
    b,
    idag,
  );
  assert.deepEqual(r.map((x) => x.sak.id), ["snart", "utlopt", "senere", "uten", "historikk", "venter"]);
});

test("ved lik frist går høyeste beløp først", () => {
  const r = rangerSaker(
    [sak("liten", "aktiv", 100), sak("stor", "aktiv", 9000)],
    [frist("liten", "2026-11-11"), frist("stor", "2026-11-11")],
    [],
    idag,
  );
  assert.equal(r[0].sak.id, "stor");
});

test("uten frist beholdes rekkefølgen fra kalleren (sist endret)", () => {
  const r = rangerSaker([sak("a", "aktiv", 1), sak("b", "aktiv", 9)], [], [], idag);
  assert.deepEqual(r.map((x) => x.sak.id), ["a", "b"]);
});

test("avsluttede saker er ikke med, selv med åpen frist", () => {
  const r = rangerSaker([sak("lukket", "fullfort")], [frist("lukket", "2026-11-11")], [], idag);
  assert.deepEqual(r, []);
  assert.equal(velgViktigsteSak([sak("lukket", "fullfort")], [], [], idag), null);
});

test("en sak som venter bruker ikke fristen til prioritering", () => {
  const r = rangerSaker([sak("v", "venter_pa_svar")], [frist("v", "2026-11-11")], [], idag);
  assert.equal(r[0].grunn, "venter");
  assert.equal(r[0].frist, null);
});

test("relevant frist i én sak er den kommende, ikke den gamle utløpte", () => {
  const r = relevantFrist(
    [frist("s", "2026-03-01", "gammelt"), frist("s", "2026-11-20", "nytt")],
    [brev("gammelt", "s", "2026-02-15"), brev("nytt", "s", "2026-11-06")],
    idag,
  );
  assert.equal(r?.frist.forfallsdato, "2026-11-20");
});

test("sisteBrevPerSak: dato slår opprettet, brev uten dato kommer sist", () => {
  const m = sisteBrevPerSak([
    brev("uten", "s", null, false, "2026-11-09T10:00:00Z"),
    brev("gammel", "s", "2026-10-01", false, "2026-11-08T10:00:00Z"),
    brev("ny", "s", "2026-11-01", false, "2026-11-02T10:00:00Z"),
  ]);
  assert.equal(m.get("s")?.id, "ny");
});

test("akseptert avtale uten frist kommer etter aktive saker, foran gamle frister", () => {
  const r = rangerSaker(
    [
      { id: "avtale", status: "aktiv" as const, belop_totalt: 0, utfall: "nedbetalingsavtale" },
      { id: "historikk", status: "aktiv" as const, belop_totalt: 0, utfall: null },
      { id: "uten", status: "aktiv" as const, belop_totalt: 0, utfall: null },
    ],
    [frist("historikk", "2026-05-15", "b1")],
    [brev("b1", "historikk", "2026-05-01")],
    idag,
  );
  assert.deepEqual(r.map((x) => x.sak.id), ["uten", "avtale", "historikk"]);
  assert.equal(r[1].grunn, "nedbetaling");
});

test("akseptert avtale med kommende avdragsfrist rangeres etter fristen", () => {
  const r = velgViktigsteSak(
    [{ id: "avtale", status: "aktiv" as const, belop_totalt: 0, utfall: "nedbetalingsavtale" }, sak("uten")],
    [frist("avtale", "2026-11-11")],
    [],
    idag,
  );
  assert.equal(r?.sak.id, "avtale");
  assert.equal(r?.grunn, "frist_snart");
});

// --- Medhold-kortet ---

test("Medhold-kortet skjuler aldri en aktiv sak", () => {
  assert.equal(
    kanViseSeier([{ status: "fullfort", utfall: "medhold" }, { status: "aktiv", utfall: null }]),
    false,
  );
  assert.equal(
    kanViseSeier([{ status: "fullfort", utfall: "medhold" }, { status: "venter_pa_svar", utfall: null }]),
    false,
  );
});

test("Medhold-kortet vises når alle saker er avsluttet og nyeste er medhold", () => {
  assert.equal(kanViseSeier([{ status: "fullfort", utfall: "medhold" }, { status: "fullfort", utfall: "oppgjort" }]), true);
  assert.equal(kanViseSeier([{ status: "fullfort", utfall: "oppgjort" }]), false);
  assert.equal(kanViseSeier([]), false);
});

// --- Varsler ---

test("aktiv frist på aktiv sak varsles", () => {
  assert.equal(skalVarsles({ fullfort: false, sakStatus: "aktiv" }), true);
});

test("aktiv frist på sak som venter varsles fortsatt", () => {
  assert.equal(skalVarsles({ fullfort: false, sakStatus: "venter_pa_svar" }), true);
});

test("avsluttet sak med tidligere åpen frist varsles ikke", () => {
  assert.equal(skalVarsles({ fullfort: false, sakStatus: "fullfort" }), false);
});

test("fullført eller erstattet frist varsles ikke", () => {
  assert.equal(skalVarsles({ fullfort: true, sakStatus: "aktiv" }), false);
});

test("frist uten kjent sak varsles ikke", () => {
  assert.equal(skalVarsles({ fullfort: false, sakStatus: null }), false);
});
