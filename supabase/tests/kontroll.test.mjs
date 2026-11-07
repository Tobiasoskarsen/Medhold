// Kontrollspørringen skal virke både før og etter migrasjon 0026 og 0027, og
// vise riktig tilstand. Den er skrivefri, så den kjøres her mot en kopi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { byggDatabase, lesMigrasjon } from "./hjelp.mjs";

const KONTROLL = readFileSync("supabase/kontroll/for_0026_0027.sql", "utf8");
const verdi = (rader, objekt) => rader.find((r) => r.objekt === objekt)?.verdi;

test("kontrollen viser «mangler» før og «finnes» etter migrasjonen", async () => {
  const db = await byggDatabase("0025");
  const for_ = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(for_, "frister.fullfort_at"), "mangler");
  assert.equal(verdi(for_, "lagre_brev"), "mangler");
  assert.equal(verdi(for_, "saker_set_sist_endret"), "finnes");
  assert.equal(verdi(for_, "frister: brev fra en annen sak"), "0");

  await db.exec(lesMigrasjon("0026"));
  await db.exec(lesMigrasjon("0027"));
  const etter = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(etter, "frister.fullfort_at"), "finnes");
  assert.equal(verdi(etter, "lagre_brev"), "finnes");
  assert.equal(verdi(etter, "brev_statusovergang"), "finnes");
  assert.equal(verdi(etter, "lagre_brev: anon kan kjøre"), "false");
  assert.match(verdi(etter, "saker.saker_utfall_check") ?? "", /nedbetalingstilbud/);
  assert.ok(verdi(etter, "frister.frister_erstattet_brev_sak_fkey"));
  assert.ok(verdi(etter, "frister.frister_status_konsistent"));
  await db.close();
});

test("kontrollen er skrivefri: bare én SELECT, ingen skrivende nøkkelord", () => {
  const kode = KONTROLL.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(kode, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute)\b/i);
  assert.equal((kode.match(/;/g) ?? []).length, 1);
});
