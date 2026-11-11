import { test } from "node:test";
import assert from "node:assert/strict";

import { brevforklaring, visForklaring } from "./brevforklaring.ts";
import { BREVTYPER } from "./gjeld.ts";

const N = " ";
const TESTBREV_38 = {
  avsender: "Nordkapp Inkasso AS",
  brevtype: "betalingsoppfordring",
  brevdato: "2026-11-02",
  belop: 4912.3,
  saksnummer: "NK-883104",
};

test("testbrev 38: to korte setninger", () => {
  assert.equal(
    brevforklaring(TESTBREV_38),
    `Dette er en betalingsoppfordring fra Nordkapp Inkasso AS, datert 2. november 2026.\n\nDe krever 4${N}912,30 kr. Saksnummeret er NK-883104.`,
  );
});

test("alle brevtyper får riktig artikkel", () => {
  const forventet: Record<string, string> = {
    faktura: "en faktura",
    purring: "en purring",
    inkassovarsel: "et inkassovarsel",
    betalingsoppfordring: "en betalingsoppfordring",
    forliksrad: "et brev om forliksrådet",
    namsmann: "et brev om tvangsinndrivelse",
    nedbetaling: "et brev om nedbetaling",
    avsluttet: "et brev om at saken er avsluttet",
    annet: "et brev",
  };
  assert.deepEqual([...BREVTYPER].sort(), Object.keys(forventet).sort(), "alle typer i BREVTYPER er dekket");
  for (const bt of BREVTYPER) {
    assert.ok(brevforklaring({ ...TESTBREV_38, brevtype: bt }).startsWith(`Dette er ${forventet[bt]} fra Nordkapp`), bt);
  }
  assert.ok(brevforklaring({ ...TESTBREV_38, brevtype: null }).startsWith("Dette er et brev fra"));
  assert.ok(brevforklaring({ ...TESTBREV_38, brevtype: "tull" }).startsWith("Dette er et brev fra"));
});

test("manglende avsender, dato, beløp og saksnummer, hver for seg", () => {
  assert.ok(brevforklaring({ ...TESTBREV_38, avsender: "  " }).startsWith("Dette er en betalingsoppfordring, datert 2. november 2026."));
  assert.ok(brevforklaring({ ...TESTBREV_38, brevdato: "" }).startsWith("Dette er en betalingsoppfordring fra Nordkapp Inkasso AS.\n\n"));
  assert.ok(brevforklaring({ ...TESTBREV_38, belop: null }).endsWith("Vi fant ikke totalbeløpet i brevet. Saksnummeret er NK-883104."));
  assert.ok(brevforklaring({ ...TESTBREV_38, saksnummer: "" }).endsWith(`De krever 4${N}912,30 kr.`));
  assert.equal(
    brevforklaring({ avsender: "", brevtype: null, brevdato: "", belop: null, saksnummer: "" }),
    "Dette er et brev.\n\nVi fant ikke totalbeløpet i brevet.",
  );
});

test("forklaringen inneholder ingen forbehold eller vurderinger", () => {
  const t = brevforklaring(TESTBREV_38);
  assert.doesNotMatch(t, /rådgivning|bekrefter ikke|Kontroller opplysningene|ukjent|Opplysninger fra brevet/);
});

test("gamle forklaringer bygges på nytt fra lagrede felt, annen tekst vises som før", () => {
  const gammel = "Opplysninger fra brevet: Avsender er Nordkapp Inkasso AS. Registrert brevtype er betalingsoppfordring.\n\nOppgitt totalbeløp: 4 912,3 kr.";
  assert.equal(visForklaring(gammel, TESTBREV_38), brevforklaring(TESTBREV_38));
  assert.equal(visForklaring("En eldre AI-forklaring.", TESTBREV_38), "En eldre AI-forklaring.");
  assert.equal(visForklaring(null, TESTBREV_38), "");
  assert.equal(
    visForklaring(gammel, { avsender: null, brevtype: null, brevdato: null, belop: null, saksnummer: null }),
    "Dette er et brev.\n\nVi fant ikke totalbeløpet i brevet.",
  );
});
