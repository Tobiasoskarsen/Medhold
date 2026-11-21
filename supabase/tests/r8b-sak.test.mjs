import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const les = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('R8b: forbeholdet er ett avsnitt, og begge sikkerhetssetningene står ordrett', () => {
  const brand = les('src/lib/brand.ts');
  const omfang = les('src/lib/kontrollomfang.ts');
  const kompo = les('src/components/KontrollOmfang.tsx');
  assert.match(brand, /Medhold sjekker gebyrer og frister mot loven, men er ikke en advokat\. Du bestemmer og sender selv\./);
  assert.match(omfang, /Medhold har ikke kontrollert den juridiske fristen for denne brevtypen\./);
  // Begge tekstene skal ligge i samme <p>, i samme størrelse.
  const m = kompo.match(/<p className="text-meta text-dempet">([\s\S]*?)<\/p>/);
  assert.ok(m, 'ett forbehold-avsnitt');
  assert.ok(m[1].includes('FRIST_IKKE_KONTROLLERT') && m[1].includes('FORBEHOLD'));
  assert.ok(!/<p>\{FRIST_IKKE_KONTROLLERT\}<\/p>/.test(kompo), 'ikke et eget avsnitt med annen stil');
});

test('R8b: Veivalg viser ikke «Du sender brevet selv.», men beholder «Ingenting sendes automatisk»', () => {
  const v = les('src/components/Veivalg.tsx');
  assert.ok(!v.includes('Du sender brevet selv.'));
  assert.ok(v.includes('Ingenting sendes automatisk'));
});

test('R8b: ingen <summary> viser nettleserens trekant', () => {
  const css = les('src/app/globals.css');
  assert.match(css, /summary \{ list-style: none; \}/);
  assert.match(css, /summary::-webkit-details-marker \{ display: none; \}/);
  assert.match(css, /\.detaljkort > summary::after/);
  assert.match(css, /\.detaljrad > summary::after/);
  const page = les('src/app/(app)/krav/[id]/page.tsx');
  assert.match(page, /<details className="detaljkort /);
});
