import { test } from "node:test";
import assert from "node:assert/strict";

import { erGyldigFodselsnummer, maskerFodselsnummer } from "./maskering.ts";

// «01010150074» er konstruert til å passere begge mod11-kontrollene.
const GYLDIG = "01010150074";

test("erGyldigFodselsnummer godtar et gyldig nummer", () => {
  assert.equal(erGyldigFodselsnummer(GYLDIG), true);
});

test("erGyldigFodselsnummer avviser feil kontrollsiffer og feil lengde", () => {
  assert.equal(erGyldigFodselsnummer("01010150075"), false); // k2 feil
  assert.equal(erGyldigFodselsnummer("11111111111"), false); // ugyldig
  assert.equal(erGyldigFodselsnummer("1234567890"), false); // 10 sifre
});

test("maskerer et gyldig fødselsnummer i fritekst", () => {
  const ut = maskerFodselsnummer(`Fødselsnummer: ${GYLDIG} står i brevet.`);
  assert.match(ut, /\[fødselsnummer skjult\]/);
  assert.ok(!ut.includes(GYLDIG));
});

test("maskerer også med mellomrom etter de seks første", () => {
  const ut = maskerFodselsnummer("010101 50074");
  assert.equal(ut, "[fødselsnummer skjult]");
});

test("rører IKKE et 11-sifret kontonummer som ikke er gyldig fnr", () => {
  const konto = "12345678903"; // ikke et gyldig fødselsnummer
  assert.equal(erGyldigFodselsnummer(konto), false);
  assert.equal(maskerFodselsnummer(`Konto ${konto}`), `Konto ${konto}`);
});

test("rører ikke sifre inne i et lengre tall", () => {
  // Det gyldige nummeret ligger inne i et 13-sifret tall → ikke et frittstående fnr.
  const lang = `99${GYLDIG}`;
  assert.equal(maskerFodselsnummer(lang), lang);
});

test("beholder resten av teksten uendret", () => {
  const inn = `Hei. Saksnr 55512. Beløp 2 400 kr. Fnr ${GYLDIG}. Mvh`;
  const ut = maskerFodselsnummer(inn);
  assert.match(ut, /Saksnr 55512/);
  assert.match(ut, /2 400 kr/);
  assert.match(ut, /\[fødselsnummer skjult\]/);
});
