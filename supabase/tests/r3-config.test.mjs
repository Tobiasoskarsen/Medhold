import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('R3: CI uten full testkonfigurasjon feiler uten lokal fallback', () => {
  const env = { ...process.env, CI: 'true', TEST_SUPABASE_URL: '', TEST_SUPABASE_PUBLISHABLE_KEY: '', TEST_SUPABASE_SECRET_KEY: '' };
  const r = spawnSync(process.execPath, ['scripts/test-supabase-r2.mjs', '--run-test-project'], { env, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Alle tre TEST_SUPABASE-verdier kreves/);
});
test('R3: full CI-konfigurasjon med feil prosjekt stoppes før tilgang', () => {
  const env = { ...process.env, CI: 'true', TEST_SUPABASE_URL: 'https://wrong-project.invalid', TEST_SUPABASE_PUBLISHABLE_KEY: 'synthetic', TEST_SUPABASE_SECRET_KEY: 'synthetic' };
  const r = spawnSync(process.execPath, ['scripts/test-supabase-r2.mjs', '--run-test-project'], { env, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Uventet prosjekt, stopp/);
});
