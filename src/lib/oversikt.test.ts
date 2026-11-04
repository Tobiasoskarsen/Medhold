import { test } from "node:test";
import assert from "node:assert/strict";

import {
  beregnOversikt,
  hjemIngress,
  type HjemIngressInput,
  type SakOppsummering, saksGrupper, brukGruppering } from "./oversikt.ts";
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

// --- hjemIngress (Retning B §5.1) ---

function ingress(over: Partial<HjemIngressInput>): string {
  return hjemIngress({
    antallSaker: 3,
    antallAktive: 2,
    antallUtlopteFrister: 0,
    antallUtlopteFraGamleBrev: 0,
    sakerMedFristDenneUka: 0,
    toppVenter: false,
    ...over,
  });
}

test("hjemIngress regel 1: ingen aktive, men løste saker finnes", () => {
  assert.equal(
    ingress({ antallSaker: 2, antallAktive: 0 }),
    "Ingen aktive saker. Godt jobbet.",
  );
});

test("hjemIngress regel 2: ingen saker i det hele tatt", () => {
  assert.equal(
    ingress({ antallSaker: 0, antallAktive: 0 }),
    "Ett brev om gangen. Vi tar det rolig.",
  );
});

test("hjemIngress regel 3: utløpt frist går foran frister denne uka", () => {
  assert.equal(
    ingress({ antallUtlopteFrister: 1, sakerMedFristDenneUka: 2, toppVenter: true }),
    "En frist har gått ut. Se hva du kan gjøre.",
  );
});

test("hjemIngress regel 3 gjelder ikke utløpte frister fra gamle brev", () => {
  assert.equal(
    ingress({ antallUtlopteFrister: 1, antallUtlopteFraGamleBrev: 1 }),
    "2 aktive saker. Ingen frister denne uka.",
  );
  assert.equal(
    ingress({
      antallUtlopteFrister: 1,
      antallUtlopteFraGamleBrev: 1,
      sakerMedFristDenneUka: 1,
    }),
    "Én sak trenger deg denne uka.",
  );
});

test("hjemIngress regel 3: én fersk utløpt frist holder, selv med gamle i tillegg", () => {
  assert.equal(
    ingress({ antallUtlopteFrister: 2, antallUtlopteFraGamleBrev: 1 }),
    "En frist har gått ut. Se hva du kan gjøre.",
  );
});

test("hjemIngress regel 4: frister denne uka, entall og flertall", () => {
  assert.equal(ingress({ sakerMedFristDenneUka: 1 }), "Én sak trenger deg denne uka.");
  assert.equal(ingress({ sakerMedFristDenneUka: 3 }), "3 saker trenger deg denne uka.");
});

test("hjemIngress regel 5: toppsaken venter på svar", () => {
  assert.equal(ingress({ toppVenter: true }), "Du venter på svar.");
});

test("hjemIngress regel 6: aktive saker uten frister denne uka, entall og flertall", () => {
  assert.equal(
    ingress({ antallAktive: 1 }),
    "Én aktiv sak. Ingen frister denne uka.",
  );
  assert.equal(
    ingress({ antallAktive: 4 }),
    "4 aktive saker. Ingen frister denne uka.",
  );
});

test("null-beløp teller som 0 i samletKravAktive", () => {
  const res = beregnOversikt([
    sak({ id: "a", belopTotalt: null }),
    sak({ id: "b", belopTotalt: 500 }),
  ]);
  assert.equal(res.samletKravAktive, 500);
});

// --- saksGrupper (statusgrupper på Saker) ---

const saker = (a: number, v: number, f: number) => [
  ...Array.from({ length: a }, (_, i) => ({ id: `a${i}`, status: "aktiv" as const })),
  ...Array.from({ length: v }, (_, i) => ({ id: `v${i}`, status: "venter_pa_svar" as const })),
  ...Array.from({ length: f }, (_, i) => ({ id: `f${i}`, status: "fullfort" as const })),
];

test("saksGrupper: antall stemmer for 0, 1, 4, 5, 10 og 11 saker", () => {
  for (const n of [0, 1, 4, 5, 10, 11]) {
    const g = saksGrupper(saker(n, 0, 0));
    assert.equal(g.trengerHandling.length, n);
    assert.equal(g.venter.length, 0);
    assert.equal(g.avsluttet.length, 0);
  }
});

test("saksGrupper: blandede statuser havner i riktig gruppe og beholder rekkefølgen", () => {
  const g = saksGrupper([...saker(2, 1, 1), { id: "a9", status: "aktiv" as const }]);
  assert.deepEqual(g.trengerHandling.map((s) => s.id), ["a0", "a1", "a9"]);
  assert.deepEqual(g.venter.map((s) => s.id), ["v0"]);
  assert.deepEqual(g.avsluttet.map((s) => s.id), ["f0"]);
});

test("brukGruppering: først over 10 saker som trenger handling", () => {
  assert.equal(brukGruppering(10), false);
  assert.equal(brukGruppering(11), true);
});
