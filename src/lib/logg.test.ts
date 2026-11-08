import { test } from "node:test";
import assert from "node:assert/strict";

import { feilInfo, loggRad, rensData } from "./logg.ts";

// Syntetiske personopplysninger. Ingen av dem skal noen gang havne i en loggrad.
const FNR = "01010150074";
const EPOST = "kari.nordmann@example.com";
const BREV = "Hei Kari Nordmann, du skylder 670,10 kr. Fødselsnummer 010101 50074.";
const KONTO = "1234.56.78903";

test("tall, sannhetsverdier og korte koder slipper gjennom", () => {
  assert.deepEqual(rensData({ inn: 1200, ut: 340, ok: true, feil: "avbrutt", status: 429 }), {
    inn: 1200,
    ut: 340,
    ok: true,
    feil: "avbrutt",
    status: 429,
  });
});

test("brevtekst, e-post, fødselsnummer og kontonummer holdes tilbake", () => {
  const rad = loggRad("legg-til-brev", "steg_for_langt", {
    tekst: BREV,
    epost: EPOST,
    fnr: FNR,
    konto: KONTO,
    liste: ["a", "b"],
    objekt: { fnr: FNR },
  });
  for (const hemmelig of [FNR, "50074", EPOST, "Kari", "670,10", KONTO]) {
    assert.ok(!rad.includes(hemmelig), `${hemmelig} lekket: ${rad}`);
  }
  assert.match(rad, /\[holdt tilbake\]/);
});

test("tall med skilletegn holdes tilbake, korte koder gjør ikke det", () => {
  assert.deepEqual(rensData({ konto: "1234.56.78903", tlf: "412-34-567", kode: "23505", modell: "claude-haiku-4-5" }), {
    konto: "[holdt tilbake]",
    tlf: "[holdt tilbake]",
    kode: "23505",
    modell: "claude-haiku-4-5",
  });
});

test("nøkler med fritekst droppes", () => {
  assert.deepEqual(rensData({ "Kari Nordmann": 1 }), {});
});

test("feilInfo tar med type og kode, aldri meldingen", () => {
  const e = Object.assign(new Error(`Feil for ${EPOST} med ${FNR}`), { code: "23505", status: 409 });
  const rad = loggRad("x", "y", feilInfo(e));
  assert.ok(!rad.includes(EPOST) && !rad.includes(FNR));
  assert.match(rad, /"kode":"23505"/);
  assert.match(rad, /"status":409/);
});
