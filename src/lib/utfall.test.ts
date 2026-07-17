import { test } from "node:test";
import assert from "node:assert/strict";

import { utfallOvergang, svarUtfallTilSak } from "./utfall.ts";

test("medhold → fullført, ingen stadium-endring", () => {
  assert.deepEqual(utfallOvergang("medhold"), {
    utfall: "medhold",
    status: "fullfort",
  });
});

test("nedbetalingsavtale → fullført + stadium nedbetaling (Plan B §5)", () => {
  assert.deepEqual(utfallOvergang("nedbetalingsavtale"), {
    utfall: "nedbetalingsavtale",
    status: "fullfort",
    stadium: "nedbetaling",
  });
});

test("oppgjort → fullført", () => {
  assert.deepEqual(utfallOvergang("oppgjort"), {
    utfall: "oppgjort",
    status: "fullfort",
  });
});

test("delvis_medhold og avvist → aktiv", () => {
  assert.deepEqual(utfallOvergang("delvis_medhold"), {
    utfall: "delvis_medhold",
    status: "aktiv",
  });
  assert.deepEqual(utfallOvergang("avvist"), {
    utfall: "avvist",
    status: "aktiv",
  });
});

test("svarUtfallTilSak mapper riktig", () => {
  assert.equal(svarUtfallTilSak("uklart"), null);
  assert.equal(svarUtfallTilSak("nedbetalingstilbud"), "nedbetalingsavtale");
  assert.equal(svarUtfallTilSak("medhold"), "medhold");
  assert.equal(svarUtfallTilSak("avvist"), "avvist");
});
