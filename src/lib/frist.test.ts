import { test } from "node:test";
import assert from "node:assert/strict";

import { sammenlignFrist } from "./frist.ts";
import type { BeregnetFrist } from "./gjeld.ts";

function beregnet(forfallsdato: string, tittel = "Betalingsfrist"): BeregnetFrist {
  return { tittel, forfallsdato, kilde: "beregnet" };
}

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
