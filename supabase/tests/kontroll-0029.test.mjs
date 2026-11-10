// Kontrollspørringen for 0029 skal virke før og etter migrasjonen, vise riktig
// tilstand og være skrivefri.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { byggDatabase, lesMigrasjon } from "./hjelp.mjs";

const KONTROLL = readFileSync("supabase/kontroll/for_0029.sql", "utf8");
const verdi = (rader, objekt) => rader.find((r) => r.objekt === objekt)?.verdi;

test("kontrollen viser riktig tilstand før og etter 0029", async () => {
  const db = await byggDatabase("0025");
  for (const m of ["0026", "0027", "0028"]) await db.exec(lesMigrasjon(m));
  const for_ = (await db.query(KONTROLL)).rows;
  assert.equal(verdi(for_, "lagre_brev (0027)"), "finnes");
  assert.equal(verdi(for_, "lagringsforsok"), "mangler");
  assert.equal(verdi(for_, "lagre_brev: versjon"), "før 0029");
  assert.equal(verdi(for_, "reserver_kvote: service_role kan kjøre"), "funksjonen mangler");

  await db.exec(lesMigrasjon("0029"));
  const etter = (await db.query(KONTROLL)).rows;
  // Alt som har en fast forventning, skal stemme.
  for (const r of etter) {
    if (["finnes", "true", "false", "0029"].includes(r.forventet)) assert.equal(r.verdi, r.forventet, r.objekt);
  }
  assert.equal(verdi(etter, "lagringsforsok: authenticated kan lese"), "true");
  assert.equal(etter.filter((r) => r.seksjon === "4 indeks").length, 8);
  await db.close();
});

test("kontrollen er skrivefri: bare én SELECT, ingen skrivende nøkkelord", () => {
  const kode = KONTROLL.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(kode, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute)\b/i);
  assert.equal((kode.match(/;/g) ?? []).length, 1);
});
