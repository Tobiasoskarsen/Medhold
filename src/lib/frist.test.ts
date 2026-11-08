import { test } from "node:test";
import assert from "node:assert/strict";

import { sammenlignFrist, erGammeltBrev, brevAlderDager, fristKildeForDato } from "./frist.ts";
import type { BeregnetFrist } from "./gjeld.ts";

function beregnet(forfallsdato: string, tittel = "Betalingsfrist"): BeregnetFrist {
  return { tittel, forfallsdato, kilde: "beregnet" };
}

test("R3: eksplisitt kilde beholdes ved lik, kortere og lengre dato", () => {
  for (const dato of ["2026-11-15", "2026-11-22", "2026-11-29"]) {
    const funn = sammenlignFrist({ tittel: "Frist i brevet", forfallsdato: dato }, beregnet("2026-11-22"));
    assert.equal(fristKildeForDato("beregnet", dato, funn), "brev_eksplisitt");
    assert.equal(fristKildeForDato("manuell", dato, funn), "manuell");
    assert.equal(fristKildeForDato("beregnet", "2026-12-01", funn), "beregnet");
  }
  assert.equal(fristKildeForDato("beregnet", "2026-11-22", sammenlignFrist(null, beregnet("2026-11-22"))), "beregnet");
  assert.equal(fristKildeForDato("beregnet", "2026-11-22", null), "beregnet");
});

test("begge null gir null", () => {
  assert.equal(sammenlignFrist(null, null), null);
});

test("kun eksplisitt finnes", () => {
  const res = sammenlignFrist(
    { tittel: "Betal innen", forfallsdato: "2026-07-24" },
    null,
  );
  assert.deepEqual(res, {
    visForfallsdato: "2026-07-24",
    visTittel: "Betal innen",
    status: "kun_eksplisitt",
    eksplisittDato: "2026-07-24",
    beregnetDato: null,
    differanseDager: null,
  });
});

test("kun beregnet finnes", () => {
  const res = sammenlignFrist(null, beregnet("2026-07-24"));
  assert.deepEqual(res, {
    visForfallsdato: "2026-07-24",
    visTittel: "Betalingsfrist",
    status: "kun_beregnet",
    eksplisittDato: null,
    beregnetDato: "2026-07-24",
    differanseDager: null,
  });
});

test("identisk dato gir samstemmer, én rad, beregnet sin tittel", () => {
  const res = sammenlignFrist(
    { tittel: "Betal innen", forfallsdato: "2026-07-24" },
    beregnet("2026-07-24"),
  );
  assert.equal(res?.status, "samstemmer");
  assert.equal(res?.visForfallsdato, "2026-07-24");
  assert.equal(res?.visTittel, "Betalingsfrist");
  assert.equal(res?.differanseDager, 0);
});

test("eksplisitt kortere enn beregnet gir avvik_kortere, negativ differanse, viser brevets dato", () => {
  // Testbrev 13: brevet gir 7 dager, loven krever 14.
  const res = sammenlignFrist(
    { tittel: "Betal innen", forfallsdato: "2026-07-17" },
    beregnet("2026-07-24"),
  );
  assert.equal(res?.status, "avvik_kortere");
  assert.equal(res?.differanseDager, -7);
  assert.equal(res?.visForfallsdato, "2026-07-17");
  assert.equal(res?.visTittel, "Betal innen");
  assert.equal(res?.eksplisittDato, "2026-07-17");
  assert.equal(res?.beregnetDato, "2026-07-24");
});

test("eksplisitt lengre enn beregnet gir avvik_lengre, positiv differanse, viser brevets (gunstigere) dato", () => {
  const res = sammenlignFrist(
    { tittel: "Betal innen", forfallsdato: "2026-08-01" },
    beregnet("2026-07-24"),
  );
  assert.equal(res?.status, "avvik_lengre");
  assert.equal(res?.differanseDager, 8);
  assert.equal(res?.visForfallsdato, "2026-08-01");
});

// --- erGammeltBrev (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2) ---

test("erGammeltBrev: 45 dager er ikke gammelt, 46 er det", () => {
  assert.equal(erGammeltBrev("2026-07-20", "2026-07-21T10:00:00Z", "2026-09-03"), false);
  assert.equal(erGammeltBrev("2026-07-20", "2026-07-21T10:00:00Z", "2026-09-04"), true);
});

test("erGammeltBrev: testbrev 13 (20. juli) i november er gammelt", () => {
  assert.equal(erGammeltBrev("2026-07-20", "2026-11-01T08:00:00Z", "2026-11-04"), true);
});

test("erGammeltBrev: uten brevdato brukes opprettet-datoen", () => {
  assert.equal(erGammeltBrev(null, "2026-10-30T23:00:00Z", "2026-11-04"), false);
  assert.equal(erGammeltBrev(null, "2026-08-01T08:00:00Z", "2026-11-04"), true);
});

test("erGammeltBrev: brev fra i dag eller fremtiden er ikke gammelt", () => {
  assert.equal(erGammeltBrev("2026-11-04", "2026-11-04T08:00:00Z", "2026-11-04"), false);
  assert.equal(erGammeltBrev("2026-12-01", "2026-11-04T08:00:00Z", "2026-11-04"), false);
});

test("brevAlderDager teller hele dager", () => {
  assert.equal(brevAlderDager("2026-07-20", "2026-07-20T00:00:00Z", "2026-11-04"), 107);
});
