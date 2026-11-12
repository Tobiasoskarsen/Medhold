// Deterministisk fasit (MEDHOLD_SIKKERHET_ARBEIDSORDRE §E.2). Kjører reglene
// (gebyrsjekk, frist, sum) på de RIKTIGE feltene fra fasit/forventet/*.json —
// skrevet inn for hånd fra PDF-ene — og sjekker at de gir det en jurist ville
// sagt. Fanger regelfeil uavhengig av AI-lesingen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { sjekkKostnader, KOSTNADSTYPER, RENTE_KAN_VAERE_OVER, type Kostnadstype } from "./gebyr.ts";
import { beregnFrist, BREVTYPER, type BrevType } from "./gjeld.ts";
import { sammenlignFrist } from "./frist.ts";
import { kontrollerSum } from "./sumkontroll.ts";

type Forventet = {
  brev: string;
  brevtype: BrevType;
  brevdato: string | null;
  belop: number | null;
  hovedstol: number | null;
  kostnadslinjer: { type: Kostnadstype; belop: number; renteFra?: string; renteTil?: string; rentesats?: number }[];
  fristIBrevet: string | null;
  saksnummer: string | null;
  avsender: string | null;
  forventetGebyrsjekk: string[];
  forventetFristfunn: string | null;
  forventetSum: string;
};

const mappe = new URL("../../fasit/forventet/", import.meta.url);
const filer = readdirSync(mappe)
  .filter((f) => f.endsWith(".json"))
  .sort();

test("fasitsettet har minst én forventet-fil", () => {
  assert.ok(filer.length > 0);
});

for (const fil of filer) {
  const f = JSON.parse(readFileSync(new URL(fil, mappe), "utf8")) as Forventet;
  const linjer = f.kostnadslinjer.map((l) => ({ ...l, tekst: "" }));

  test(`${fil}: feltene er gyldige`, () => {
    assert.ok(BREVTYPER.includes(f.brevtype), `brevtype ${f.brevtype}`);
    for (const l of f.kostnadslinjer)
      assert.ok(KOSTNADSTYPER.includes(l.type), `kostnadstype ${l.type}`);
    assert.equal(f.forventetGebyrsjekk.length, f.kostnadslinjer.length);
    for (const k of ["saksnummer", "avsender", "fristIBrevet", "brevdato"] as const)
      assert.ok(k in f, `mangler ${k}`);
  });

  test(`${fil}: gebyrsjekken stemmer med fasit`, () => {
    // Hovedstolen er «kjent» når fasit har den; brevtypen er stadiet.
    const r = sjekkKostnader(linjer, f.hovedstol, f.brevdato, f.brevtype, f.hovedstol !== null);
    // En jurist ville sagt «over» på en klart for høy rente. Appen viser det som
    // «mulig_over» til lesingen er målt og godkjent (RENTE_KAN_VAERE_OVER).
    const forventet = f.forventetGebyrsjekk.map((v, i) =>
      v === "over" && f.kostnadslinjer[i].type === "forsinkelsesrente" && !RENTE_KAN_VAERE_OVER ? "mulig_over" : v,
    );
    assert.deepEqual(
      r.linjer.map((l) => l.vurdering),
      forventet,
    );
  });

  test(`${fil}: fristfunnet stemmer med fasit`, () => {
    const beregnet = f.brevdato ? beregnFrist(f.brevtype, f.brevdato) : null;
    const eksplisitt = f.fristIBrevet
      ? { tittel: "Frist i brevet", forfallsdato: f.fristIBrevet }
      : null;
    const s = sammenlignFrist(eksplisitt, beregnet);
    assert.equal(s?.status ?? null, f.forventetFristfunn);
  });

  test(`${fil}: sumkontrollen stemmer med fasit`, () => {
    assert.equal(
      kontrollerSum(f.belop, f.hovedstol, f.kostnadslinjer).status,
      f.forventetSum,
    );
  });
}
