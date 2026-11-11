import { test } from "node:test";
import assert from "node:assert/strict";

import { formaterBelop, formaterKr, normaliserBelopITekst, tolkKr, tellOrd, kuttTilMaks } from "./format.ts";
import { validerKravbelop } from "./format.ts";
import { brevforklaring } from "./brevforklaring.ts";
import { fristKontrollStottes } from "./kontrollomfang.ts";

test("S1-E: friststøtte følger eksisterende regelmotor, ikke en ny 14-dagersregel", () => {
  assert.equal(fristKontrollStottes("inkassovarsel"), true);
  assert.equal(fristKontrollStottes("betalingsoppfordring"), true);
  for (const t of ["namsmann", "forliksrad", "annet", "ukjent", null]) assert.equal(fristKontrollStottes(t), false);
});

test("S1-D: oppsummering følger rettede felt uten oppdiktet historikk", () => {
  const f = { avsender: "Strømmeriket AS", brevtype: "inkassovarsel", brevdato: "2026-07-20", belop: 1100, saksnummer: "TEST-1" };
  const t = brevforklaring(f);
  assert.match(t, /Strømmeriket AS/);
  assert.match(t, /1[ \u00a0]100/);
  assert.doesNotMatch(t, /arrest|strømabonnement|siste steg|allerede varslet|vil bli sendt/);
  assert.match(brevforklaring({ ...f, belop: 289 }), /289 kr/);
  assert.doesNotMatch(brevforklaring({ ...f, belop: 289 }), /1[ \u00a0]100/);
  assert.match(brevforklaring({ ...f, belop: null, avsender: "", brevdato: "" }), /Vi fant ikke totalbeløpet/);
});

test("S1-B: norske beløp valideres uten tap av øre", () => {
  for (const s of ["3243,20", "3 243,20", "3 243,20", "3 243,20"]) {
    assert.deepEqual(validerKravbelop(s), { status: "gyldig", ore: 324320, kroner: 3243.2 });
  }
  assert.deepEqual(validerKravbelop(""), { status: "ukjent" });
  assert.deepEqual(validerKravbelop("0,50"), { status: "gyldig", ore: 50, kroner: 0.5 });
  assert.deepEqual(validerKravbelop("0"), { status: "gyldig", ore: 0, kroner: 0 });
  assert.deepEqual(validerKravbelop("3243"), { status: "gyldig", ore: 324300, kroner: 3243 });
});

test("S1-B: ugyldig beløp blir aldri ukjent eller positivt", () => {
  for (const s of ["-100", "abc", "NaN", "Infinity", "1,234.56", "12 34", "1,234", "999999999999999999999", "abc100", "1.23.4"]) {
    assert.equal(validerKravbelop(s).status, "ugyldig", s);
  }
});

test("formaterBelop: norsk tusenskille, ingen desimaler", () => {
  // Intl.NumberFormat("nb-NO") bruker hardt mellomrom (U+00A0), ikke vanlig.
  assert.equal(formaterBelop(3243), "3 243");
  assert.equal(formaterBelop(500), "500");
  assert.equal(formaterBelop(null), null);
  assert.equal(formaterBelop(undefined), null);
});

test("formaterBelop: registrert øre beholdes også for store beløp", () => {
  assert.equal(formaterBelop(1234567.89), "1 234 567,89");
  assert.equal(formaterBelop(1288.5), "1 288,50");
  assert.equal(formaterBelop(0.01), "0,01");
});

test("tolkKr: internasjonalt format med punktum som desimaltegn (regresjonstest)", () => {
  // Dette er nøyaktig scenariet som feilet: «3201.80» ble tolket som 320180.
  assert.equal(tolkKr("3201.80"), 3201.8);
});

test("tolkKr: norsk format med komma som desimaltegn", () => {
  assert.equal(tolkKr("3201,80"), 3201.8);
});

test("tolkKr: norsk format med mellomrom som tusenskille og komma som desimal", () => {
  assert.equal(tolkKr("3 201,80"), 3201.8);
});

test("tolkKr: fullt norsk format med punktum som tusenskille og komma som desimal", () => {
  assert.equal(tolkKr("3.201,80"), 3201.8);
});

test("tolkKr: hele kroner uten øre", () => {
  assert.equal(tolkKr("3201"), 3201);
  assert.equal(tolkKr("3 201"), 3201);
});

test("tolkKr: punktum som tusenskille uten desimaler (3+ sifre etter siste punktum)", () => {
  assert.equal(tolkKr("1.234"), 1234);
});

test("tolkKr: «kr»-suffiks fjernes", () => {
  assert.equal(tolkKr("3201,80 kr"), 3201.8);
  assert.equal(tolkKr("3201 kr."), 3201);
});

test("tolkKr: tom eller manglende streng gir null", () => {
  assert.equal(tolkKr(""), null);
  assert.equal(tolkKr("   "), null);
  assert.equal(tolkKr(null), null);
  assert.equal(tolkKr(undefined), null);
});

test("tolkKr: ugyldig tekst gir null", () => {
  assert.equal(tolkKr("ukjent"), null);
});

test("tolkKr: étt siffer øre", () => {
  assert.equal(tolkKr("100,5"), 100.5);
});

test("tellOrd: teller ord adskilt av mellomrom", () => {
  assert.equal(tellOrd("Dette er fire ord"), 4);
});

test("tellOrd: håndterer flere mellomrom og linjeskift", () => {
  assert.equal(tellOrd("Ett   to\ntre"), 3);
});

test("tellOrd: tom eller kun mellomrom gir 0", () => {
  assert.equal(tellOrd(""), 0);
  assert.equal(tellOrd("   "), 0);
});

test("tellOrd: ett ord gir 1", () => {
  assert.equal(tellOrd("Enkeltord"), 1);
});

test("kuttTilMaks: kutter til maks antall, beholder rekkefølge", () => {
  assert.deepEqual(kuttTilMaks(["a", "b", "c", "d"], 3), ["a", "b", "c"]);
});

test("kuttTilMaks: kortere liste enn maks er urørt", () => {
  assert.deepEqual(kuttTilMaks(["a"], 3), ["a"]);
});

test("kuttTilMaks: liste nøyaktig lik maks er urørt", () => {
  assert.deepEqual(kuttTilMaks(["a", "b", "c"], 3), ["a", "b", "c"]);
});

test("kuttTilMaks: tom liste forblir tom", () => {
  assert.deepEqual(kuttTilMaks([], 3), []);
});

test("formaterKr: hele kroner uten desimaler, ellers nøyaktig to", () => {
  assert.equal(formaterKr(3108.9), "3 108,90");
  assert.equal(formaterKr(2340), "2 340");
  assert.equal(formaterKr(0.5), "0,50");
  assert.equal(formaterKr(1288), "1 288");
  assert.equal(formaterKr(4912.3), "4 912,30");
  assert.equal(formaterKr(187.5), "187,50");
  // Flyttallsstøy rundt hele kroner gir ikke «,00».
  assert.equal(formaterKr(0.1 + 0.2 + 99.7), "100");
  // Tusenskillet er det samme tegnet som Intl brukte før (NBSP).
  assert.equal(formaterKr(2340), new Intl.NumberFormat("nb-NO").format(2340));
});

test("normaliserBelopITekst: bare tall med én desimal før «kr» endres", () => {
  const inn = "Jeg betaler derfor 3 108,9 kr. Gebyret er 18,90 kr, salæret 750 kr. Datert 29.10.2026.";
  assert.equal(
    normaliserBelopITekst(inn),
    "Jeg betaler derfor 3 108,90 kr. Gebyret er 18,90 kr, salæret 750 kr. Datert 29.10.2026.",
  );
  assert.equal(normaliserBelopITekst("3 108,9 kr"), "3 108,90 kr");
  assert.equal(normaliserBelopITekst("54,3 kr og 0,5kr"), "54,30 kr og 0,50kr");
  assert.equal(normaliserBelopITekst("3,5 kroner"), "3,5 kroner");
});
