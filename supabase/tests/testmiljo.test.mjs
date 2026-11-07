// Den samlede fila for testprosjektet skal være oppdatert med migrasjonene, og
// kjøre feilfritt på en helt tom database til samme tilstand som migrasjonene.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { lagTestmiljoSql, UT } from "../../scripts/lag-testmiljo-sql.mjs";

const SUPABASE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

test("oppsett.sql er generert fra gjeldende migrasjoner", () => {
  assert.equal(
    readFileSync(UT, "utf8").replace(/\r\n/g, "\n"),
    lagTestmiljoSql(),
    "kjør node scripts/lag-testmiljo-sql.mjs",
  );
});

test("oppsett.sql bygger en tom database feilfritt, og kontrollen viser alt på plass", async () => {
  const db = new PGlite();
  await db.exec(SUPABASE);
  await db.exec(readFileSync(UT, "utf8"));
  const k = (await db.query(readFileSync("supabase/kontroll/for_0026_0028.sql", "utf8"))).rows;
  const v = (o) => k.find((r) => r.objekt === o)?.verdi;
  assert.equal(v("frister.fullfort_at"), "finnes");
  assert.equal(v("lagre_brev"), "finnes");
  assert.equal(v("brev_statusovergang"), "finnes");
  assert.equal(v("lagre_brev: anon kan kjøre"), "false");
  assert.ok(v("frister.frister_status_konsistent"));
  assert.equal(v("frister.frister_erstattet_er_lukket"), undefined);
  const tabeller = (await db.query(`select tablename from pg_tables where schemaname = 'public' order by 1`)).rows.map((r) => r.tablename);
  assert.ok(!tabeller.includes("document_note"));
  for (const t of ["saker", "brev", "frister", "utkast", "brev_samtale", "profiler", "sendte_varsler", "sendte_oppfolginger"]) {
    assert.ok(tabeller.includes(t), t);
  }
  await db.close();
});
