// Felles oppsett for databasetestene: ekte Postgres (PGlite) satt opp som
// Supabase-produksjon. Roller og auth.uid() er gjenskapt; resten er migrasjonene
// slik de ligger i repoet. 0014 hoppes over, som i produksjon (erstattet av 0025).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DIR = "supabase/migrations";

/** Migrasjonsfilene til og med `til` (f.eks. "0025"), uten 0014. */
export function migrasjoner(til) {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.startsWith("0014") && f.slice(0, 4) <= til)
    .sort();
}

export function lesMigrasjon(navn) {
  const fil = readdirSync(DIR).find((f) => f.startsWith(navn));
  if (!fil) throw new Error(`Fant ikke migrasjon ${navn}`);
  return readFileSync(join(DIR, fil), "utf8");
}

export async function byggDatabase(til) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const f of migrasjoner(til)) await db.exec(readFileSync(join(DIR, f), "utf8"));
  return db;
}

/**
 * Kjører SQL som en innlogget bruker (eller uinnlogget når bruker er null), i
 * egen transaksjon. Returnerer resultatet eller feilmeldingen, kaster aldri.
 */
export async function som(db, bruker, sql, params = []) {
  await db.exec("begin");
  try {
    await db.exec(
      `set local role ${bruker ? "authenticated" : "anon"}; set local request.jwt.claim.sub = '${bruker ?? ""}';`,
    );
    const r = await db.query(sql, params);
    await db.exec("commit");
    return { ok: true, rader: r.affectedRows ?? r.rows.length, rows: r.rows };
  } catch (e) {
    await db.exec("rollback");
    return { ok: false, feil: e.message };
  }
}

export async function rad(db, sql, params = []) {
  return (await db.query(sql, params)).rows[0];
}
