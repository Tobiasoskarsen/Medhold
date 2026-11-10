// Kontrollspørringen skal virke i alle tilstander (før 0026, etter 0026 slik
// produksjon er nå, og etter 0028), og vise riktig tilstand. Den er skrivefri.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { byggDatabase, lesMigrasjon } from "./hjelp.mjs";

const KONTROLL = readFileSync("supabase/kontroll/for_0026_0028.sql", "utf8");
const verdi = (rader, objekt) => rader.find((r) => r.objekt === objekt)?.verdi;

test("kontrollen viser riktig tilstand før 0026, etter 0026 og etter 0028", async () => {
  const db = await byggDatabase("0025");
  const for_ = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(for_, "frister.fullfort_at"), "mangler");
  assert.equal(verdi(for_, "lagre_brev"), "mangler");
  assert.equal(verdi(for_, "saker_set_sist_endret"), "finnes");
  assert.equal(verdi(for_, "frister: brev fra en annen sak"), "0");

  // Slik produksjon er nå: 0026 kjørt, 0027 og 0028 ikke.
  await db.exec(lesMigrasjon("0026"));
  const prod = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(prod, "frister.fullfort_at"), "finnes");
  assert.equal(verdi(prod, "lagre_brev"), "mangler");
  assert.ok(verdi(prod, "frister.frister_erstattet_av_brev_id_fkey"));
  assert.ok(verdi(prod, "frister.frister_erstattet_er_lukket"));
  assert.equal(verdi(prod, "frister.frister_status_konsistent"), undefined);

  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0028"));
  const etter = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(etter, "lagre_brev"), "finnes");
  assert.equal(verdi(etter, "brev_statusovergang"), "finnes");
  assert.equal(verdi(etter, "lagre_brev: anon kan kjøre"), "false");
  assert.match(verdi(etter, "saker.saker_utfall_check") ?? "", /nedbetalingstilbud/);
  assert.ok(verdi(etter, "frister.frister_erstattet_brev_sak_fkey"));
  assert.ok(verdi(etter, "frister.frister_status_konsistent"));
  assert.equal(verdi(etter, "frister.frister_erstattet_av_brev_id_fkey"), undefined);
  assert.equal(verdi(etter, "frister.frister_erstattet_er_lukket"), undefined);
  await db.close();
});

test("kontrollen er skrivefri: bare én SELECT, ingen skrivende nøkkelord", () => {
  const kode = KONTROLL.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(kode, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute)\b/i);
  assert.equal((kode.match(/;/g) ?? []).length, 1);
});
