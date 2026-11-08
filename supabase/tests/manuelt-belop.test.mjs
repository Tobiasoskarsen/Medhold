// Kjører den faktiske serverhandlingen mot lokal Postgres. Bare Next/auth og
// Supabase-transporten erstattes; validering og INSERT-payload er produksjonskode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { byggDatabase, som } from "./hjelp.mjs";
import * as format from "../../src/lib/format.ts";

const require = createRequire(import.meta.url);
const bruker = "11111111-1111-4111-8111-111111111111";
const fil = readFileSync("src/app/(app)/krav/actions.ts", "utf8");
const js = ts.transpileModule(fil, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

test("S1-B: faktisk opprettKrav validerer og lagrer korrekt i Postgres", async () => {
  const db = await byggDatabase("0029");
  try {
    await db.query("insert into auth.users(id) values ($1)", [bruker]);
    let innsettinger = 0;
    let innlogget = true;
    const klient = {
      auth: { getUser: async () => ({ data: { user: innlogget ? { id: bruker } : null } }) },
      from: (tabell) => {
        assert.equal(tabell, "saker");
        return { insert: (payload) => {
          innsettinger++;
          return { select: () => ({ single: async () => {
            const r = await som(db, bruker,
              "insert into saker(bruker_id,tittel,kreditor,saksnummer,belop_totalt,stadium,status,kategori) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id,belop_totalt",
              [payload.bruker_id,payload.tittel,payload.kreditor,payload.saksnummer,payload.belop_totalt,payload.stadium,payload.status,payload.kategori]);
            return { data: r.ok ? r.rows[0] : null, error: r.ok ? null : r.feil };
          } }) };
        } };
      },
    };
    const exports = {};
    new Function("require", "exports", js)((navn) => {
      if (navn === "next/cache") return { revalidatePath() {} };
      if (navn === "next/navigation") return { redirect() { throw new Error("REDIRECT"); } };
      if (navn === "@/lib/supabase/server") return { createClient: async () => klient };
      if (navn === "@/lib/format") return format;
      if (navn === "@/lib/gjeld") return { STADIER: ["faktura"] };
      if (navn === "@/lib/saksstatus") return {};
      return require(navn);
    }, exports);
    const input = { kreditor: "TEST", saksnummer: "TEST-S1B", stadium: "faktura" };
    for (const [belop, forventet] of [["3 243,20",3243.2],["3 243,20",3243.2],["3 243,20",3243.2],["0,50",0.5],["0",0],["",null]]) {
      const r = await exports.opprettKrav({ ...input, belop });
      assert.equal(r.ok, true, JSON.stringify(r));
      const lagret = await db.query("select belop_totalt from saker where id=$1", [r.sakId]);
      const n = lagret.rows[0].belop_totalt;
      assert.equal(n === null ? null : Number(n), forventet);
    }
    const forAntall = innsettinger;
    for (const belop of ["-100","NaN","Infinity","abc","1,234","1,234.56","99999999999999999",100,null]) {
      const r = await exports.opprettKrav({ ...input, belop });
      assert.equal(r.ok, false);
      assert.match(r.feil, /Skriv et positivt beløp/);
    }
    assert.equal(innsettinger, forAntall, "ugyldig input må stoppe før INSERT");
    innlogget = false;
    await assert.rejects(exports.opprettKrav({ ...input, belop: "100" }), /REDIRECT/);
    assert.equal(innsettinger, forAntall);
  } finally {
    await db.close();
  }
});
