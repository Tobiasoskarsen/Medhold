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
import { skalVarsles } from "./prioritet.ts";

test("medhold og oppgjort avslutter saken", () => {
  assert.deepEqual(utfallOvergang("medhold"), { utfall: "medhold", status: "fullfort" });
  assert.deepEqual(utfallOvergang("oppgjort"), { utfall: "oppgjort", status: "fullfort" });
});

test("akseptert nedbetalingsavtale holder saken åpen med stadium nedbetaling", () => {
  assert.deepEqual(utfallOvergang("nedbetalingsavtale"), {
    utfall: "nedbetalingsavtale",
    status: "aktiv",
    stadium: "nedbetaling",
  });
  assert.equal(utfallAvslutter("nedbetalingsavtale"), false);
});

test("avtale akseptert → delbetaling → oppgjort: åpen helt til siste steg", () => {
  // Akseptert: saken er aktiv og fristene varsles fortsatt.
  const akseptert = oppdateringForUtfall("nedbetalingsavtale");
  assert.equal(akseptert.status, "aktiv");
  assert.equal(skalVarsles({ fullfort: false, sakStatus: akseptert.status }), true);
  // Delbetaling: et nytt brev uten utfall endrer ikke statusen.
  const delbetaling = statusVedNyttBrev({
    statusNa: akseptert.status,
    utfall: null,
    nyeFrister: ["2026-12-10"],
    idag: "2026-11-10",
  });
  assert.equal(delbetaling.status, "aktiv");
  assert.equal(delbetaling.utfall, undefined);
  // Oppgjort: først nå avsluttes saken, og varslene stopper.
  const oppgjort = oppdateringForUtfall("oppgjort");
  assert.equal(oppgjort.status, "fullfort");
  assert.equal(skalVarsles({ fullfort: false, sakStatus: oppgjort.status }), false);
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

// --- Nytt brev -------------------------------------------------------------

const idag = "2026-11-10";

test("nytt brev med kommende frist flytter en ventende sak til aktiv", () => {
  const r = statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: null, nyeFrister: ["2026-11-24"], idag });
  assert.equal(r.status, "aktiv");
  assert.equal(r.gjenapnet, true);
  assert.equal(r.utfall, undefined);
});

test("frist i dag teller som kommende", () => {
  const r = statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: null, nyeFrister: [idag], idag });
  assert.equal(r.status, "aktiv");
});

test("nytt brev uten frist lar en ventende sak vente", () => {
  const r = statusVedNyttBrev({ statusNa: "venter_pa_svar", utfall: null, nyeFrister: [], idag });
  assert.equal(r.status, "venter_pa_svar");
  assert.equal(r.gjenapnet, false);
});

test("avsluttet sak + bekreftelsesbrev uten frist forblir avsluttet", () => {
  const r = statusVedNyttBrev({ statusNa: "fullfort", utfall: null, nyeFrister: [], idag });
  assert.deepEqual(r, { status: "fullfort", gjenapnet: false, kommendeFrist: false });
});

test("avsluttet sak + gammelt brev med utløpt frist forblir avsluttet", () => {
  const r = statusVedNyttBrev({ statusNa: "fullfort", utfall: null, nyeFrister: ["2026-01-01"], idag });
  assert.deepEqual(r, { status: "fullfort", gjenapnet: false, kommendeFrist: false });
});

test("avsluttet sak + alvorlig brev med allerede utløpt hastefrist forblir avsluttet", () => {
  const r = statusVedNyttBrev({ statusNa: "fullfort", utfall: null, nyeFrister: ["2026-11-09"], idag });
  assert.equal(r.status, "fullfort");
  assert.equal(r.gjenapnet, false);
});

test("avsluttet sak + kommende frist åpnes IKKE uten eksplisitt valg", () => {
  const r = statusVedNyttBrev({ statusNa: "fullfort", utfall: null, nyeFrister: ["2026-11-24"], idag });
  assert.deepEqual(r, { status: "fullfort", gjenapnet: false, kommendeFrist: true });
});

test("avsluttet sak åpnes ved eksplisitt valg, og utfallet beholdes", () => {
  const r = statusVedNyttBrev({
    statusNa: "fullfort",
    utfall: null,
    nyeFrister: ["2026-11-24"],
    idag,
    gjenapne: true,
  });
  assert.equal(r.status, "aktiv");
  assert.equal(r.gjenapnet, true);
  assert.equal(r.utfall, undefined, "utfallet skal ikke slettes");
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
  assert.match(utfallVisning("medhold", true).tittel, /frafalt/);
  for (const u of ["avvist", "nedbetalingstilbud", "nedbetalingsavtale", "oppgjort", null] as const) {
    for (const avsluttet of [true, false]) {
      const v = utfallVisning(u, avsluttet);
      assert.doesNotMatch(`${v.tittel} ${v.under ?? ""}`, /frafalt/, `${u} ${avsluttet}`);
    }
  }
});

test("delvis medhold sier tydelig at kravet ikke er frafalt", () => {
  const v = utfallVisning("delvis_medhold", false);
  assert.equal(v.tittel, "Delvis medhold");
  assert.match(v.under ?? "", /redusert, ikke frafalt/);
  assert.notEqual(v.farge, "text-gull");
});

test("avvist innsigelse sier at kravet står", () => {
  const v = utfallVisning("avvist", false);
  assert.equal(v.tittel, "Innsigelsen er avvist");
  assert.match(v.under ?? "", /står fortsatt/);
});

test("tilbud sier at det ikke er en avtale", () => {
  assert.match(utfallVisning("nedbetalingstilbud", false).under ?? "", /ingen avtale/);
});

test("akseptert avtale på åpen sak: nedbetaling pågår", () => {
  assert.equal(utfallVisning("nedbetalingsavtale", false).tittel, "Nedbetaling pågår");
  assert.equal(utfallVisning("nedbetalingsavtale", true).tittel, "Avtale på plass.");
});

test("avsluttende utfall på en åpnet sak vises som historikk", () => {
  const v = utfallVisning("medhold", false);
  assert.equal(v.tittel, "Saken er åpnet igjen");
  assert.match(v.under ?? "", /Tidligere utfall: Medhold/);
  assert.notEqual(v.farge, "text-gull");
});
