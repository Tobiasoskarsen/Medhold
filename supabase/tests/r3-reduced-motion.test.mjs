import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const React = require('react');
const tokens = { INNTREDEN: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }, VARIGHET: { hurtig: .15, normal: .2 }, EASING: [.32, .72, 0, 1], MAKS_STAGGER: 8, STIGRING: .05, ORKESTER_STIGRING: .07, FJAER: { type: 'spring' } };
function load(file, reduced, mode = 'fane') {
  const exports = {};
  const mocks = {
    react: { ...React, useState: () => [mode] },
    'motion/react': { m: { div: 'motion.div' }, useReducedMotion: () => reduced },
    '@/lib/bevegelse': tokens,
    '@/components/ui/BunnNav': { FANE_NAV_NOKKEL: 'medhold-fane-nav' },
  };
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', js)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), exports);
  return exports;
}

test('R3: redusert bevegelse viser faner og dybderuter uten skjult innledningsramme', () => {
  for (const mode of ['fane', 'dybde']) {
    const tree = load('src/app/(app)/template.tsx', true, mode).default({ children: 'Saksinnhold' });
    assert.equal(tree.props.initial, false);
    assert.equal(tree.props.transition.duration, 0);
    assert.equal(tree.props.children, 'Saksinnhold');
  }
});
test('R3: seksjonsinntreden starter synlig og uten forsinkelse ved redusert bevegelse', () => {
  const props = load('src/components/ui/Sekvens.tsx', true).useInntreden(.6);
  assert.equal(props.initial, false);
  assert.equal(props.animate.opacity, 1);
  assert.equal(props.transition.duration, 0);
  assert.equal(props.transition.delay ?? 0, 0);
});
test('R3: skjermramme hopper over skjulte stagger-barn ved redusert bevegelse', () => {
  const tree = load('src/components/ui/Skjermramme.tsx', true).Skjermramme({ children: ['Overskrift', 'Saker'], bred: true });
  assert.equal(tree.type, 'motion.div');
  assert.equal(tree.props.initial, false);
  assert.deepEqual(tree.props.children.map(child => child.props.children), ['Overskrift', 'Saker']);
  for (const child of tree.props.children) assert.deepEqual(child.props.variants.animate.transition, { duration: 0 });
  assert.match(tree.props.className, /lg:max-w/);
});
test('R3: vanlig inntreden og delt overgang beholder eksisterende oppførsel', () => {
  const tree = load('src/app/(app)/template.tsx', false).default({ children: 'Saker' });
  assert.equal(tree.props.initial.opacity, 0);
  assert.equal(tree.props.transition.duration, .15);
  const shared = load('src/app/(app)/template.tsx', false, 'delt').default({ children: 'Sak' });
  assert.equal(shared.type, React.Fragment);
  const props = load('src/components/ui/Sekvens.tsx', false).useInntreden(.4);
  assert.equal(props.initial.opacity, 0);
  assert.equal(props.transition.delay, .4);
  assert.equal(load('src/components/ui/Skjermramme.tsx', false).Skjermramme({ children: 'Saker' }).type, 'motion.div');
});
test('R3: SSR uten kjent bevegelsesvalg merker alle skjulte innholdsrammer for CSS-sikringen', () => {
  const route = load('src/app/(app)/template.tsx', null).default({ children: 'Saker' });
  const section = load('src/components/ui/Sekvens.tsx', null).SekvensDel({ children: 'Saker' }).props.children;
  const frame = load('src/components/ui/Skjermramme.tsx', null).Skjermramme({ children: 'Saker' }).props.children[0];
  for (const wrapper of [route, section, frame]) assert.match(wrapper.props.className, /\bskjerm-inntreden\b/);
});
