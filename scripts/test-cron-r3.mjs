// Opt-in: ekte Resend, bare syntetiske testdata og eksplisitt eid mottaker.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import ts from 'typescript';

assert.ok(process.argv.includes('--send-owned-test-email'), 'Ekte testutsending krever opt-in');
const recipient = process.env.R3_TEST_EMAIL;
assert.ok(recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient), 'Eid testadresse kreves');
function envFile(path) {
  const result = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) { try { result[m[1]] = JSON.parse(m[2]); } catch { result[m[1]] = m[2]; } }
  }
  return result;
}
const testEnv = envFile('.env.test.local');
assert.equal(testEnv.NEXT_PUBLIC_SUPABASE_URL, 'https://evvzxblhaxaraaurbhsu.supabase.co');
const mailEnv = envFile('.env.local');
assert.ok(mailEnv.RESEND_API_KEY, 'Resend-nøkkel mangler');
process.env.RESEND_API_KEY = mailEnv.RESEND_API_KEY;
if (mailEnv.VARSEL_FRA_EPOST) process.env.VARSEL_FRA_EPOST = mailEnv.VARSEL_FRA_EPOST;
process.env.NEXT_PUBLIC_APP_URL = 'https://example.invalid';
process.env.CRON_SECRET = randomUUID();
const db = createClient(testEnv.NEXT_PUBLIC_SUPABASE_URL, testEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const require = createRequire(import.meta.url);
function load(file, mocks, cache = new Map()) {
  file = resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', js)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    let path = name.startsWith('@/') ? resolve('src', name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null;
    if (!path) return require(name);
    if (!existsSync(path)) path += '.ts';
    return load(path, mocks, cache);
  }, exports);
  return exports;
}
function ok(r) { if (r.error) throw Object.assign(new Error('Testoperasjon feilet'), { code: r.error.code }); return r.data; }
let userId;
const report = { prosjekt: 'evvzxblhaxaraaurbhsu', tidspunkt: new Date().toISOString(), syntetisk: true, eidMottaker: true, cleanup: false };
const realFetch = globalThis.fetch;
const acceptedIds = new Set();
globalThis.fetch = async (url, options) => {
  const result = await realFetch(url, options);
  if (String(url) === 'https://api.resend.com/emails' && result.ok) {
    const body = await result.clone().json(); if (body.id) acceptedIds.add(body.id);
  }
  return result;
};
try {
  const user = ok(await db.auth.admin.createUser({ email: `r3-cron-${randomUUID()}@example.invalid`, email_confirm: true })).user;
  userId = user.id;
  const sak = ok(await db.from('saker').insert({ bruker_id: userId, tittel: 'Syntetisk R3-påminnelse', status: 'aktiv', stadium: 'inkassovarsel' }).select('id').single());
  const { idagOslo } = load('src/lib/dato.ts', {});
  const dato = new Date(Date.parse(`${idagOslo()}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  ok(await db.from('frister').insert({ bruker_id: userId, sak_id: sak.id, tittel: 'Syntetisk test – ingen betaling eller handling nødvendig', forfallsdato: dato, kilde: 'manuell' }));
  // Eksakt avgrenset DB-adapter. Ingen andre kontoer kan bli cron-kandidater.
  // Bare testkontoens oppslag erstattes med den eksplisitt eide mottakeren.
  const scoped = {
    auth: { admin: { getUserById: async id => { assert.equal(id, userId); return { data: { user: { email: recipient, user_metadata: {} } } }; } } },
    from(table) { const q = db.from(table); return {
      select(...args) { return q.select(...args).eq('bruker_id', userId); },
      upsert(rows, options) { assert.ok((Array.isArray(rows) ? rows : [rows]).every(r => r.bruker_id === userId)); return q.upsert(rows, options); },
    }; },
  };
  const { GET } = load('src/app/api/cron/paaminnelser/route.ts', { '@/lib/supabase/admin': { createAdminClient: () => scoped } });
  const req = dry => ({ headers: new Headers({ authorization: `Bearer ${process.env.CRON_SECRET}` }), nextUrl: new URL(`http://localhost/cron${dry ? '?dryRun=1' : ''}`) });
  const dry = await (await GET(req(true))).json();
  assert.equal(dry.sendt, 1); assert.equal(acceptedIds.size, 0); report.dryRun = true;
  // Parallelle kjøringer av samme rutemodul og ekte e-postadapter.
  const parallel = await Promise.all([GET(req(false)), GET(req(false))]);
  assert.ok(parallel.every(r => r.status === 200));
  assert.equal(acceptedIds.size, 1, 'Nøyaktig én unik Resend-melding skal være akseptert');
  const receipts = ok(await db.from('sendte_varsler').select('id').eq('bruker_id', userId));
  assert.equal(receipts.length, 1);
  await GET(req(false)); assert.equal(acceptedIds.size, 1);
  report.unikeAksepterteMeldinger = 1; report.kvitteringer = 1; report.retryUtenNyMelding = true;
  // GET kan være utilgjengelig for sending-only-nøkler. Aldri logg payload.
  const delivery = await realFetch(`https://api.resend.com/emails/${[...acceptedIds][0]}`, { headers: { Authorization: `Bearer ${mailEnv.RESEND_API_KEY}` } });
  report.leverandorOppslagStatus = delivery.status;
  if (delivery.ok) report.leverandorHendelse = (await delivery.json()).last_event ?? 'ukjent';
  report.status = 'bestått';
} catch (e) { report.status = 'feilet'; report.feilkode = e.code ?? e.name ?? 'ukjent'; process.exitCode = 1; }
finally {
  globalThis.fetch = realFetch;
  if (userId) report.cleanup = !(await db.auth.admin.deleteUser(userId)).error;
  writeFileSync('docs/testing/r3-cron-resultat.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.cleanup) process.exitCode = 1;
}
