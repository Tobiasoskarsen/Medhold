import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks = {}, cache = new Map()) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', js)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    let path = name.startsWith('@/') ? resolve('src', name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null;
    if (!path) return require(name);
    if (!existsSync(path)) path += existsSync(path + '.ts') ? '.ts' : '.tsx';
    return load(path, mocks, cache);
  }, exports);
  return exports;
}

test('R2-rest: e-postadapter videresender stabil idempotensnøkkel, ingen faktisk utsending', async () => {
  const original = globalThis.fetch, key = process.env.RESEND_API_KEY;
  const calls = [];
  process.env.RESEND_API_KEY = 'synthetic';
  globalThis.fetch = async (_url, options) => { calls.push(options); return new Response('{}'); };
  try {
    const mail = load('src/lib/epost.ts');
    const rows = [{ tittel: 'Syntetisk', forfallsdato: '2026-11-15', sakTittel: 'Test' }];
    await Promise.all([mail.sendFristPaaminnelse('a@example.invalid', rows, 'frister/a/2026-11-08'), mail.sendFristPaaminnelse('a@example.invalid', rows, 'frister/a/2026-11-08')]);
    assert.equal(calls[0].headers['Idempotency-Key'], 'frister/a/2026-11-08');
    assert.deepEqual(calls[0], calls[1]);
    await mail.sendOppfolging('a@example.invalid', 'Test', 'oppfolging/sak-a');
    assert.equal(calls[2].headers['Idempotency-Key'], 'oppfolging/sak-a');
    globalThis.fetch = async () => new Response('{}', { status: 409 });
    assert.equal(await mail.sendOppfolging('a@example.invalid', 'Test', 'oppfolging/sak-a'), false);
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = key;
  }
});

function fixture({ historyError = false } = {}) {
  const delivered = new Set(), calls = [], records = [];
  const today = load('src/lib/dato.ts').idagOslo();
  const date = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const db = {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'synthetic@example.invalid', user_metadata: {} } } }) } },
    from(table) {
      const rows = table === 'frister' ? [{ id: 'frist-a', bruker_id: 'a', fullfort: false, forfallsdato: date, tittel: 'Test', saker: { tittel: 'Test', status: 'aktiv' } }] : [];
      const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lte() { return q; }, in() { return q; }, returns() { return q; },
        upsert(value) { records.push(value); return Promise.resolve({ error: null }); },
        then(ok) { return Promise.resolve({ data: rows, error: table === 'sendte_varsler' && historyError ? { code: 'synthetic' } : null }).then(ok); },
      };
      return q;
    },
  };
  const route = load('src/app/api/cron/paaminnelser/route.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/epost': {
      sendFristPaaminnelse: async (_to, rows, key) => { calls.push({ rows, key }); delivered.add(key); return true; },
      sendOppfolging: async () => { throw Error('Ingen ventende saker'); },
    },
  });
  const request = (authorized = true, dryRun = false) => ({ headers: new Headers(authorized ? { authorization: 'Bearer synthetic-cron' } : {}), nextUrl: new URL(`http://localhost/cron${dryRun ? '?dryRun=1' : ''}`) });
  return { route, request, calls, delivered, records };
}

test('R2-rest: parallelle cron-kall bruker samme leverandørnøkkel', async () => {
  const old = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-cron';
  try {
    const f = fixture();
    const responses = await Promise.all([f.route.GET(f.request()), f.route.GET(f.request())]);
    assert.ok(responses.every(r => r.status === 200));
    assert.equal(f.calls.length, 2); assert.equal(f.delivered.size, 1);
    assert.match(f.calls[0].key, /^frister\/a\/\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(f.calls[0], f.calls[1]);
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});

test('R2-rest: cron dryRun og uautorisert kall sender og skriver ingenting', async () => {
  const old = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-cron';
  try {
    const f = fixture();
    assert.equal((await f.route.GET(f.request(false))).status, 401);
    assert.equal((await f.route.GET(f.request(true, true))).status, 200);
    assert.equal(f.calls.length, 0); assert.equal(f.records.length, 0);
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});

test('R2-rest: feil ved lesing av varselhistorikk stopper utsending', async () => {
  const old = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-cron';
  try {
    const f = fixture({ historyError: true });
    assert.equal((await f.route.GET(f.request())).status, 500);
    assert.equal(f.calls.length, 0); assert.equal(f.records.length, 0);
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});
