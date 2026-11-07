import { test } from "node:test";
import assert from "node:assert/strict";

import {
  avsluttendeForslag,
  forhandsvalgtUtfall,
  oppdateringForUtfall,
  statusVedNyttBrev,
  svarUtfallTilSak,
  utfallAvslutter,
  utfallOvergang,
  utfallVisning,
} from "./utfall.ts";

test("medhold → fullført, ingen stadium-endring", () => {
  assert.deepEqual(utfallOvergang("medhold"), {
    utfall: "medhold",
    status: "fullfort",
  });
});

test("akseptert nedbetalingsavtale → fullført + stadium nedbetaling", () => {
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

test("delvis medhold, avvist og tilbud holder saken åpen", () => {
  for (const u of ["delvis_medhold", "avvist", "nedbetalingstilbud"] as const) {
    assert.deepEqual(utfallOvergang(u), { utfall: u, status: "aktiv" });
    assert.equal(utfallAvslutter(u), false);
  }
});

test("tilbud om nedbetaling tolkes aldri som en avtale", () => {
  assert.equal(svarUtfallTilSak("nedbetalingstilbud"), "nedbetalingstilbud");
  assert.equal(svarUtfallTilSak("uklart"), null);
  assert.equal(svarUtfallTilSak("medhold"), "medhold");
  assert.equal(svarUtfallTilSak("avvist"), "avvist");
});

test("AI-forslag som avslutter saken er aldri forhåndsvalgt", () => {
  assert.equal(forhandsvalgtUtfall("medhold"), null);
  assert.equal(avsluttendeForslag("medhold"), "medhold");
});

test("AI-forslag som holder saken åpen kan være forhåndsvalgt", () => {
  for (const s of ["delvis_medhold", "avvist", "nedbetalingstilbud"] as const) {
    assert.equal(forhandsvalgtUtfall(s), s);
    assert.equal(avsluttendeForslag(s), null);
  }
  assert.equal(forhandsvalgtUtfall("uklart"), null);
  assert.equal(avsluttendeForslag("uklart"), null);
});

test("«Annet / vet ikke» avslutter uten utfall", () => {
  assert.equal(utfallAvslutter(null), true);
  assert.deepEqual(oppdateringForUtfall(null), { status: "fullfort", utfall: null });
});

test("oppdateringForUtfall følger samme regel som utfallOvergang", () => {
  assert.deepEqual(oppdateringForUtfall("avvist"), { status: "aktiv", utfall: "avvist" });
  assert.deepEqual(oppdateringForUtfall("nedbetalingsavtale"), {
    status: "fullfort",
    utfall: "nedbetalingsavtale",
    stadium: "nedbetaling",
  });
});

// --- Nytt brev -------------------------------------------------------------

const idag = "2026-11-10";

test("nytt brev med kommende frist flytter en ventende sak til aktiv", () => {
  assert.deepEqual(
    statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: null, nyeFrister: ["2026-11-24"], idag }),
    { status: "aktiv", gjenapnet: true },
  );
});

test("frist i dag teller som kommende", () => {
  const r = statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: null, nyeFrister: [idag], idag });
  assert.equal(r.status, "aktiv");
});

test("nytt brev uten frist lar en ventende sak vente", () => {
  assert.deepEqual(
    statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: null, nyeFrister: [], idag }),
    { status: "venter_pa_svar", gjenapnet: false },
  );
});

test("en allerede utløpt frist i et brev åpner ikke saken", () => {
  const r = statusVedNyttBrev({ statusNa: "fullfort", utfall: null, nyeFrister: ["2026-01-01"], idag });
  assert.deepEqual(r, { status: "fullfort", gjenapnet: false });
});

test("ny kommende frist åpner en avsluttet sak og fjerner det gamle utfallet", () => {
  assert.deepEqual(
    statusVedNyttBrev({ statusNa: "fullfort", utfall: null, nyeFrister: ["2026-11-24"], idag }),
    { status: "aktiv", gjenapnet: true, utfall: null },
  );
});

test("valgt utfall bestemmer over fristen", () => {
  const r = statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: "medhold", nyeFrister: ["2026-11-24"], idag });
  assert.equal(r.status, "fullfort");
  assert.equal(r.utfall, "medhold");
  assert.equal(r.gjenapnet, false);
});

test("tilbud på en ventende sak gjør den aktiv, ikke avsluttet", () => {
  const r = statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: "nedbetalingstilbud", nyeFrister: [], idag });
  assert.equal(r.status, "aktiv");
  assert.equal(r.utfall, "nedbetalingstilbud");
});

// --- Tekster ---------------------------------------------------------------

test("bare medhold sier at kravet er frafalt", () => {
  assert.match(utfallVisning("medhold").tittel, /frafalt/);
  for (const u of ["avvist", "nedbetalingstilbud", "nedbetalingsavtale", "oppgjort", null] as const) {
    const v = utfallVisning(u);
    assert.doesNotMatch(`${v.tittel} ${v.under ?? ""}`, /frafalt/, String(u));
  }
});

test("delvis medhold sier tydelig at kravet ikke er frafalt", () => {
  const v = utfallVisning("delvis_medhold");
  assert.equal(v.tittel, "Delvis medhold");
  assert.match(v.under ?? "", /redusert, ikke frafalt/);
  assert.notEqual(v.farge, "text-gull");
});

test("avvist innsigelse sier at kravet står", () => {
  const v = utfallVisning("avvist");
  assert.equal(v.tittel, "Innsigelsen er avvist");
  assert.match(v.under ?? "", /står fortsatt/);
});

test("tilbud sier at det ikke er en avtale", () => {
  assert.match(utfallVisning("nedbetalingstilbud").under ?? "", /ingen avtale/);
});
