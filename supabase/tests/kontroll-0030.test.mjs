import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byggDatabase, lesMigrasjon } from './hjelp.mjs';

const sql = readFileSync('supabase/kontroll/release_0030.sql', 'utf8');
test('Release-preflight er skrivefri og viser faktiske objekter før og etter 0030', async () => {
  const code = sql.replace(/--.*$/gm, '').replace(/'(?:[^']|'')*'/g, "''");
  assert.doesNotMatch(code, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute)\b/i);
  assert.equal((code.match(/;/g) ?? []).length, 1);
  const db = await byggDatabase('0029');
  try {
    const before = (await db.query(sql)).rows;
    assert.ok(!before.some(r => r.objekt === 'utkast.versjon'));
    await db.exec(lesMigrasjon('0030'));
    // Supabase-lignende direkte standardgrant overlever REVOKE FROM PUBLIC.
    const interim = (await db.query(sql)).rows.find(r => r.kategori === 'funksjon' && r.objekt.startsWith('registrer_utkast_sendt('));
    assert.match(interim.detalj, /anon_execute=true/);
    await db.exec(lesMigrasjon('0031'));
    await db.exec(lesMigrasjon('0031'));
    const after = (await db.query(sql)).rows;
    for (const column of ['versjon', 'sendt_innhold', 'vakt_fakta']) assert.ok(after.some(r => r.objekt === `utkast.${column}`));
    const rpc = after.find(r => r.kategori === 'funksjon' && r.objekt.startsWith('registrer_utkast_sendt('));
    assert.ok(rpc);
    assert.match(rpc.detalj, /security_definer=false, anon_execute=false, authenticated_execute=true/);
    assert.ok(after.some(r => r.kategori === 'trigger'));
  } finally { await db.close(); }
});
