// Migrasjon 0032: preflighten virker før og etter, er skrivefri, og
// tilbakeføringen gir lagre_brev nøyaktig slik den var i 0029.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { byggDatabase, lesMigrasjon, rad } from "./hjelp.mjs";

const KONTROLL = readFileSync("supabase/kontroll/for_0032.sql", "utf8");
const TILBAKE = readFileSync("supabase/tilbakeforing/0032_tilbake.sql", "utf8");
const verdi = (rader, objekt) => rader.find((r) => r.objekt === objekt)?.verdi;
const lagreBrevKode = async (db) => (await rad(db, "select md5(prosrc) h from pg_proc where proname = 'lagre_brev'")).h;

async function tilstand029() {
  const db = await byggDatabase("0025");
  for (const m of ["0026", "0027", "0028", "0029", "0030", "0031"]) await db.exec(lesMigrasjon(m));
  return db;
}

test("preflighten viser riktig tilstand før og etter 0032", async () => {
  const db = await tilstand029();
  const for_ = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(for_, "brev_datovurdering (0029)"), "finnes");
  assert.equal(verdi(for_, "lagringsforsok (0029)"), "finnes");
  assert.equal(verdi(for_, "utkast.sendt_at (0015)"), "finnes");
  assert.equal(verdi(for_, "lagre_brev: versjon"), "0029");

  await db.exec(lesMigrasjon("0032"));
  const etter = (await db.query(KONTROLL)).rows;
  for (const r of etter) {
    if (["finnes", "true", "false", "0032"].includes(r.forventet)) assert.equal(r.verdi, r.forventet, r.objekt);
  }
  assert.equal(verdi(etter, "saker som venter på svar"), verdi(for_, "saker som venter på svar"));
  await db.close();
});

test("preflighten er skrivefri: bare én SELECT, ingen skrivende nøkkelord", () => {
  const kode = KONTROLL.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(kode, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute)\b/i);
  assert.equal((kode.match(/;/g) ?? []).length, 1);
});

test("0032 stopper før 0029, uten å endre noe", async () => {
  const db = await byggDatabase("0025");
  for (const m of ["0026", "0027", "0028"]) await db.exec(lesMigrasjon(m));
  const for_ = await lagreBrevKode(db);
  let feil = "";
  try {
    await db.exec(lesMigrasjon("0032"));
  } catch (e) {
    feil = e.message;
  }
  await db.exec("rollback").catch(() => {});
  assert.match(feil, /kjør 0029 før 0032/);
  assert.equal(await lagreBrevKode(db), for_);
  await db.close();
});

test("tilbakeføringen gir lagre_brev nøyaktig slik den var i 0029, med samme rettigheter", async () => {
  const db = await tilstand029();
  const kode029 = await lagreBrevKode(db);
  await db.exec(lesMigrasjon("0032"));
  assert.notEqual(await lagreBrevKode(db), kode029);
  await db.exec(TILBAKE);
  assert.equal(await lagreBrevKode(db), kode029);
  const r = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(r, "lagre_brev: versjon"), "0029");
  assert.equal(verdi(r, "lagre_brev: anon kan kjøre"), "false");
  assert.equal(verdi(r, "lagre_brev: authenticated kan kjøre"), "true");
  await db.close();
});
