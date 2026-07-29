import { test } from "node:test";
import assert from "node:assert/strict";

import { beregnOversikt, type SakOppsummering } from "./oversikt.ts";
import type { GebyrsjekkResultat, LinjeResultat, Vurdering } from "./gebyr.ts";

function linje(vurdering: Vurdering, differanse: number | null): LinjeResultat {
  return {
    linje: { type: "salaer", belop: 800, tekst: "Salær" },
    vurdering,
    maksLav: 300,
    maksHoy: 750,
    differanse,
    forklaring: "",
  };
}

function gebyrsjekk(linjer: LinjeResultat[]): GebyrsjekkResultat {
  return {
    satsGyldigFra: "2026-01-01",
    linjer,
    antallOver: linjer.filter((l) => l.vurdering === "over").length,
    antallMuligOver: linjer.filter((l) => l.vurdering === "mulig_over").length,
  };
}

function sak(overrides: Partial<SakOppsummering> = {}): SakOppsummering {
  return {
    id: "s1",
    status: "aktiv",
    utfall: null,
    belopTotalt: null,
    gebyrsjekk: null,
    ...overrides,
  };
}

test("tom liste gir alle felter 0", () => {
  const res = beregnOversikt([]);
  assert.deepEqual(res, {
    antallAktive: 0,
    antallAvsluttet: 0,
    samletKravAktive: 0,
    funnetOverSats: 0,
    antallSakerMedFunn: 0,
    antallMedhold: 0,
    antallAvtale: 0,
    antallOppgjort: 0,
  });
});

test("kun aktive saker teller aktiv-feltene, historikk forblir 0", () => {
  const res = beregnOversikt([
    sak({ id: "a", belopTotalt: 1000 }),
    sak({ id: "b", status: "venter_pa_svar", belopTotalt: 2000 }),
  ]);
  assert.equal(res.antallAktive, 2);
  assert.equal(res.antallAvsluttet, 0);
  assert.equal(res.samletKravAktive, 3000);
  assert.equal(res.antallMedhold, 0);
});

test("kun avsluttede saker teller historikk, ikke samletKravAktive", () => {
  const res = beregnOversikt([
    sak({ id: "a", status: "fullfort", utfall: "medhold", belopTotalt: 5000 }),
    sak({ id: "b", status: "fullfort", utfall: "delvis_medhold" }),
    sak({ id: "c", status: "fullfort", utfall: "nedbetalingsavtale" }),
    sak({ id: "d", status: "fullfort", utfall: "oppgjort" }),
  ]);
  assert.equal(res.antallAktive, 0);
  assert.equal(res.antallAvsluttet, 4);
  assert.equal(res.samletKravAktive, 0);
  assert.equal(res.antallMedhold, 2);
  assert.equal(res.antallAvtale, 1);
  assert.equal(res.antallOppgjort, 1);
});

test("blandet aktive og avsluttede", () => {
  const res = beregnOversikt([
    sak({ id: "a", belopTotalt: 1000 }),
    sak({ id: "b", status: "fullfort", utfall: "oppgjort" }),
  ]);
  assert.equal(res.antallAktive, 1);
  assert.equal(res.antallAvsluttet, 1);
  assert.equal(res.samletKravAktive, 1000);
  assert.equal(res.antallOppgjort, 1);
});

test("saker uten gebyrsjekk gir 0 funn, ingen krasj", () => {
  const res = beregnOversikt([sak({ gebyrsjekk: null })]);
  assert.equal(res.funnetOverSats, 0);
  assert.equal(res.antallSakerMedFunn, 0);
});

test("mulig_over teller aldri med i funnetOverSats/antallSakerMedFunn", () => {
  const res = beregnOversikt([
    sak({ gebyrsjekk: gebyrsjekk([linje("mulig_over", null)]) }),
  ]);
  assert.equal(res.funnetOverSats, 0);
  assert.equal(res.antallSakerMedFunn, 0);
});

test("over-linjer summeres i funnetOverSats, kun for aktive saker", () => {
  const res = beregnOversikt([
    sak({ id: "a", gebyrsjekk: gebyrsjekk([linje("over", 50)]) }),
    sak({
      id: "b",
      gebyrsjekk: gebyrsjekk([linje("over", 30), linje("mulig_over", null)]),
    }),
    // Avsluttet sak med funn skal IKKE telle med (kun aktive per §1).
    sak({
      id: "c",
      status: "fullfort",
      gebyrsjekk: gebyrsjekk([linje("over", 1000)]),
    }),
  ]);
  assert.equal(res.funnetOverSats, 80);
  assert.equal(res.antallSakerMedFunn, 2);
});

test("null-beløp teller som 0 i samletKravAktive", () => {
  const res = beregnOversikt([
    sak({ id: "a", belopTotalt: null }),
    sak({ id: "b", belopTotalt: 500 }),
  ]);
  assert.equal(res.samletKravAktive, 500);
});
