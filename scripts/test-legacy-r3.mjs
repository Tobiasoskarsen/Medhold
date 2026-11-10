// Eksakte gamle servermoduler mot oppgradert TEST, aldri produksjonsdata.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

if (!process.argv.includes('--run-test-project')) throw Error('Krever --run-test-project');
const OLD = '6516bd317e4d01816c56e62b8c25a9c6efa2fe3d';
const TEST_URL = 'https://evvzxblhaxaraaurbhsu.supabase.co';
const env = {};
for (const line of readFileSync('.env.test.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) { try { env[m[1]] = JSON.parse(m[2]); } catch { env[m[1]] = m[2]; } }
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, TEST_URL, 'Uventet prosjekt, stopp');
assert.ok(env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY, 'Testnøkler mangler');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(TEST_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const db = createClient(TEST_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const require = createRequire(import.meta.url);
const cache = new Map();
const Flyt = () => null;
const mocks = {
  'server-only': {},
  '@/lib/supabase/server': { createClient: async () => db },
  'next/cache': { revalidatePath() {} },
  'next/navigation': { redirect() { throw Error('Uventet redirect'); }, notFound() { throw Error('Uventet 404'); } },
  '@/lib/plan': { harPluss: async () => true }, // Kun isolert UI-gate, ikke auth/RLS.
  '@/components/ui': { Skjermramme: () => null },
  '@/components/ui/Toppstripe': { Toppstripe: () => null },
  '@/components/NavLenke': { NavLenke: () => null },
  './UtkastFlyt': { UtkastFlyt: Flyt },
};
function oldModule(file) {
  if (cache.has(file)) return cache.get(file);
  const source = execFileSync('git', ['show', `${OLD}:${file}`], { encoding: 'utf8' });
  const exports = {};
  cache.set(file, exports);
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', js)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    let child = name.startsWith('@/') ? 'src/' + name.slice(2) : name.startsWith('.') ? posix.join(posix.dirname(file), name) : null;
    if (!child) return require(name);
    if (!child.endsWith('.ts') && !child.endsWith('.tsx')) child += '.ts';
    return oldModule(child);
  }, exports);
  return exports;
}
function ok(result) { if (result.error) { const e = Error('Testoperasjon feilet'); e.code = result.error.code; throw e; } return result.data; }
const results = [];
async function check(id, fn) { await fn(); results.push({ id, status: 'bestått' }); }
let userId, cleanup = true;
try {
  ok(await admin.from('utkast').select('versjon,sendt_innhold,vakt_fakta').limit(0));
  const password = randomBytes(32).toString('base64url');
  const email = `medhold-r3-legacy-${randomUUID()}@example.com`;
  userId = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  const session = ok(await db.auth.signInWithPassword({ email, password }));
  assert.equal(session.user.id, userId);
  let sakId, brevId, utkastId;
  await check('LEGACY-LETTER-SAVE', async () => {
    const { lagreBrev } = oldModule('src/app/legg-til-brev/actions.ts');
    const result = await lagreBrev({ krav: { modus: 'ny', kreditor: 'Syntetisk eldre app' }, brevtype: 'inkassovarsel', brevdato: '2026-11-08', original_tekst: 'Kun syntetisk kompatibilitetstest', avsender: 'Test', avsender_epost: '', belop: 1288, hovedstol: 1250, saksnummer: 'LEGACY-01', forklaring: 'Test', foreslatte_steg: ['Syntetisk steg'], valgteFrister: [{ tittel: 'Betalingsfrist', forfallsdato: '2026-11-22', kilde: 'brev_eksplisitt' }], utfall: null, kostnadslinjer: [{ type: 'purregebyr', belop: 38 }], fristfunn: null, alvorlig: false, bekreftet: true, sumStemmerLikevel: false });
    assert.equal(result.ok, true);
    sakId = result.sakId;
    brevId = ok(await db.from('brev').select('id').eq('sak_id', sakId).single()).id;
    assert.equal(ok(await db.from('frister').select('id').eq('sak_id', sakId)).length, 1);
    assert.equal(ok(await db.from('neste_steg').select('id').eq('sak_id', sakId)).length, 1);
  });
  await check('LEGACY-DRAFT-INSERT', async () => {
    const row = ok(await db.from('utkast').insert({ sak_id: sakId, brev_id: brevId, bruker_id: userId, type: 'innsigelse', innhold: 'Syntetisk eldre utkast' }).select('id,versjon,sendt_innhold,vakt_fakta').single());
    utkastId = row.id;
    assert.equal(row.versjon, 1); assert.equal(row.sendt_innhold, null); assert.equal(row.vakt_fakta, null);
  });
  await check('LEGACY-PAGE-READ', async () => {
    const page = oldModule('src/app/(app)/krav/[id]/utkast/page.tsx').default;
    const tree = await page({ params: Promise.resolve({ id: sakId }), searchParams: Promise.resolve({ brev: brevId }) });
    function find(n) { if (!n || typeof n !== 'object') return null; if (n.type === Flyt) return n.props; return [n.props?.children].flat(Infinity).map(find).find(Boolean); }
    assert.equal(find(tree).brevId, brevId);
  });
  await check('LEGACY-SENT-SNAPSHOT', async () => {
    const { markerUtkastSendt } = oldModule('src/app/(app)/krav/[id]/utkast/actions.ts');
    assert.equal((await markerUtkastSendt(utkastId)).ok, true);
    const row = ok(await db.from('utkast').select('innhold,sendt_innhold,versjon').eq('id', utkastId).single());
    assert.equal(row.sendt_innhold, row.innhold); assert.equal(row.versjon, 2);
    assert.equal(ok(await db.from('saker').select('status').eq('id', sakId).single()).status, 'venter_pa_svar');
    assert.equal((await markerUtkastSendt(utkastId)).ok, true);
    assert.equal(ok(await db.from('utkast').select('versjon').eq('id', utkastId).single()).versjon, 2);
  });
} catch (e) { results.push({ id: 'FAIL', status: 'feilet', code: e.code ?? e.name }); }
finally {
  if (userId) cleanup = !(await admin.auth.admin.deleteUser(userId)).error;
  const report = { tidspunkt: new Date().toISOString(), prosjekt: 'evvzxblhaxaraaurbhsu', gammelApp: OLD, testRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), testkildeSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), brukerJWT: true, faktiskeGamleServermoduler: true, mockedeGrenser: ['Next cache/navigation', 'UI-komponentreferanser', 'Pluss-sidegate'], begrensninger: ['Ingen full gammel nettleserapp eller produksjonsklone', 'Gammel klient har ikke ny CAS-lagring og kan ikke brukes parallelt med ny klient under utrulling'], cleanup, results };
  writeFileSync('docs/testing/r3-legacy-resultat.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!cleanup || results.some(r => r.status === 'feilet')) process.exitCode = 1;
}
