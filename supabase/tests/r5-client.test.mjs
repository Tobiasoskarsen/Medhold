import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks, cache = new Map()) {
  file = resolve(file); if (cache.has(file)) return cache.get(file);
  const out = {}; cache.set(file, out);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', js)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    let path = name.startsWith('@/') ? resolve('src', name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null;
    if (!path) return require(name);
    if (!existsSync(path)) path += existsSync(path + '.ts') ? '.ts' : '.tsx';
    return load(path, mocks, cache);
  }, out); return out;
}
function nodes(n) { if (!n) return []; if (Array.isArray(n)) return n.flatMap(nodes); if (!n.props) return []; return [n, ...nodes(n.props.children)]; }
function text(n) { if (typeof n === 'string' || typeof n === 'number') return String(n); if (Array.isArray(n)) return n.map(text).join(''); return text(n?.props?.children ?? ''); }
const uid = '11111111-1111-4111-8111-111111111111', sid = '22222222-2222-4222-8222-222222222222';
function draft(actions, navigate = () => {}) {
  let i = 0; const state = [], pending = [], urls = [], effects = [];
  const mocks = {
    react: {
      useState(init) { const n = i++; if (!(n in state)) state[n] = typeof init === 'function' ? init() : init; return [state[n], v => state[n] = typeof v === 'function' ? v(state[n]) : v]; },
      useRef(init) { const n = i++; return state[n] ?? (state[n] = { current: init }); },
      useMemo: fn => fn(), useEffect: fn => effects.push(fn), useTransition: () => [false, fn => pending.push(fn())]
    },
    'next/navigation': { useRouter: () => ({ push(url) { urls.push(url); navigate(); }, refresh() {} }) },
    'motion/react': { m: { div: 'div', span: 'span' }, AnimatePresence: 'div', useReducedMotion: () => true },
    '@/components/ui': { Kort: 'section', 'Primærknapp': 'button' }, '@/lib/haptikk': { haptikk() {} }, './actions': actions,
    '@/components/useUlagretVern': { useUlagretVern() {} }
  };
  const { UtkastFlyt } = load('src/app/(app)/krav/[id]/utkast/UtkastFlyt.tsx', mocks);
  const props = { sakId: sid, brevId: uid, eierId: uid, avsender: 'Test', avsenderEpost: 'test@example.invalid', kreditor: 'Test', saksnummer: null, starttype: 'innsigelse', typeValgt: true, harOverGebyr: false, gebyrDiff: 0, ubestridt: null, navnStart: '', lagret: { id: uid, innhold: 'Opprinnelig tekst.', versjon: 1, sendt_at: null, sendt_innhold: null, vakt_fakta: null } };
  const h = { urls, effects, render() { i = 0; effects.length = 0; return UtkastFlyt(props); },
    button(label) { const b = nodes(h.render()).find(n => n.props.onClick && text(n) === label); assert.ok(b, label); return b; },
    edit(value) { nodes(h.render()).find(n => n.type === 'textarea').props.onChange({ target: { value } }); },
    async send() { h.button('Jeg har sendt det').props.onClick(); await Promise.all(pending.splice(0)); },
    async status() { h.button('Kontroller sendtstatus').props.onClick(); await Promise.all(pending.splice(0)); }
  }; return h;
}
test('R5: tapt sendtrespons leser status før ny skriving, låser tekst og beholder snapshot', async () => {
  let writes = 0, reads = 0;
  const h = draft({ markerUtkastSendt: async () => { writes++; throw Error('lost'); }, hentUtkastStatus: async () => { reads++; return { ok: true, tekst: 'Bevart sendt tekst.', versjon: 2, sendt: true }; } });
  await h.send(); assert.equal(writes, 1); assert.ok(text(h.render()).includes('Kunne ikke bekrefte registreringen'));
  assert.equal(nodes(h.render()).find(n => n.type === 'textarea').props.readOnly, true);
  await h.status(); assert.equal(writes, 1); assert.equal(reads, 1); assert.equal(nodes(h.render()).find(n => n.type === 'textarea').props.value, 'Bevart sendt tekst.');
  assert.ok(text(h.render()).includes('Registrert sendt')); assert.deepEqual(h.urls, []);
});
test('R5: negativ statuslesing gjør ikke automatisk et nytt sendtskriv', async () => {
  let writes = 0;
  const h = draft({ markerUtkastSendt: async () => { writes++; throw Error('lost'); }, hentUtkastStatus: async () => ({ ok: true, tekst: 'Opprinnelig tekst.', versjon: 1, sendt: false }) });
  await h.send(); await h.status(); assert.equal(writes, 1); assert.ok(h.button('Jeg har sendt det')); assert.ok(text(h.render()).includes('ikke er registrert sendt'));
});
test('R5: statuslesefeil kan ikke markere sendt eller skrive på nytt', async () => {
  let writes = 0;
  const h = draft({ markerUtkastSendt: async () => { writes++; throw Error('lost'); }, hentUtkastStatus: async () => ({ ok: false, feil: 'Ingen tilgang' }) });
  await h.send(); await h.status(); assert.equal(writes, 1); assert.ok(text(h.render()).includes('Ingen tilgang')); assert.ok(h.button('Kontroller sendtstatus'));
});
test('R5: synkron sendt-lås stopper dobbelttrykk før rerender', async () => {
  let writes = 0, done;
  const h = draft({ markerUtkastSendt: () => { writes++; return new Promise(r => done = r); } });
  const action = h.button('Jeg har sendt det').props.onClick; action(); action(); assert.equal(writes, 1); done({ ok: true, sakId: sid });
  await new Promise(r => setImmediate(r)); assert.equal(h.urls.length, 1);
});
test('R5: navigasjonsfeil etter bekreftet sendt er ikke ukjent lagring', async () => {
  const h = draft({ markerUtkastSendt: async () => ({ ok: true, sakId: sid }) }, () => { throw Error('router'); });
  await h.send(); assert.ok(text(h.render()).includes('Sendtregistreringen er lagret')); assert.ok(!text(h.render()).includes('Kontroller sendtstatus'));
});
for (const outcome of ['same', 'conflict', 'unsent']) test(`R5: tapt utkastlagring avklares (${outcome}) uten stille overskriving`, async () => {
  let writes = 0, reads = 0;
  const h = draft({ lagreRedigertUtkast: async () => { writes++; if (writes === 1) throw Error('lost'); return { ok: true, tekst: 'Min rettelse.', versjon: 2 }; }, hentUtkastStatus: async () => { reads++; return { ok: true, tekst: outcome === 'same' ? 'Min rettelse.' : 'Annen tekst.', versjon: outcome === 'unsent' ? 1 : 2, sendt: false }; } });
  h.edit('Min rettelse.'); await h.button('Lagre endringer').props.onClick(); assert.equal(nodes(h.render()).find(n => n.type === 'textarea').props.value, 'Min rettelse.');
  await h.button('Lagre endringer').props.onClick(); assert.equal(reads, 1); assert.equal(writes, outcome === 'unsent' ? 2 : 1);
  assert.ok(text(h.render()).includes(outcome === 'conflict' ? 'annen tekstversjon' : 'Utkast lagret'));
});
test('R5: ingen automatisk dokumentbuffer, bare opprydding av aktuell eldre nøkkel', () => {
  const calls = []; globalThis.sessionStorage = { removeItem: key => calls.push(key), setItem() { assert.fail('Sensitive data skal ikke skrives'); }, getItem() { assert.fail('Gammel tekst skal ikke gjenopprettes'); } };
  const h = draft({}); h.edit('Sensitiv rettelse.'); h.render(); for (const fn of h.effects) fn();
  assert.deepEqual(calls, [`medhold-utkast-${uid}-${uid}`]); delete globalThis.sessionStorage;
});
for (const mode of ['valid', 'wrong-case', 'other-user', 'anonymous', 'invalid']) test(`R5: autoritativ utkaststatus (${mode})`, async () => {
  const filters = [], user = mode === 'anonymous' ? null : { id: uid };
  const query = { select() { return this; }, eq(k, v) { filters.push([k, v]); return this; }, async maybeSingle() { return { data: mode === 'valid' ? { innhold: 'Arbeid', sendt_innhold: 'Snapshot', sendt_at: '2026-11-10', versjon: 3 } : null, error: null }; } };
  const out = load('src/app/(app)/krav/[id]/utkast/actions.ts', { 'server-only': {}, '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, from: () => query }) }, './byggUtkastPrompt': {}, 'next/navigation': {}, 'next/cache': {} });
  const r = await out.hentUtkastStatus(mode === 'invalid' ? 'bad' : uid, mode === 'wrong-case' ? uid : sid);
  assert.equal(r.ok, mode === 'valid'); if (r.ok) assert.deepEqual(r, { ok: true, tekst: 'Snapshot', versjon: 3, sendt: true });
  if (!['invalid', 'anonymous'].includes(mode)) assert.deepEqual(filters, [['id', uid], ['sak_id', mode === 'wrong-case' ? uid : sid], ['bruker_id', uid]]);
});
test('R5: navigasjonsvern bruker native advarsel uten å blokkere originalnedlasting eller hash', () => {
  const events = {}, doc = {}, confirms = [];
  globalThis.window = { location: { href: 'https://app.invalid/legg-til-brev', pathname: '/legg-til-brev', search: '' }, confirm: m => { confirms.push(m); return false; }, addEventListener: (k,v) => events[k] = v, removeEventListener: k => delete events[k] };
  globalThis.document = { addEventListener: (k,v) => doc[k] = v, removeEventListener: k => delete doc[k] };
  class Target { constructor(link) { this.link = link; } closest() { return this.link; } } globalThis.Element = Target;
  let cleanup; const out = load('src/components/useUlagretVern.ts', { react: { useEffect: fn => cleanup = fn() } });
  out.useUlagretVern(true, 'Forkaste?'); let prevented = 0;
  const event = (href, download = false) => ({ button: 0, target: new Target({ href, target: '', hasAttribute: () => download }), preventDefault() { prevented++; }, stopPropagation() {} });
  doc.click(event('https://app.invalid/krav')); assert.equal(prevented, 1); assert.equal(confirms.length, 1);
  doc.click(event('https://app.invalid/legg-til-brev#original')); doc.click(event('https://app.invalid/pdf', true)); assert.equal(confirms.length, 1);
  events.beforeunload({ preventDefault() { prevented++; } }); assert.equal(prevented, 2);
  cleanup(); assert.deepEqual(events, {}); assert.deepEqual(doc, {});
  delete globalThis.window; delete globalThis.document; delete globalThis.Element;
});
