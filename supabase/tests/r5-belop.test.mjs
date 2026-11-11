import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { formaterBelop } from '../../src/lib/format.ts';

test('R5: opptelling ender på nøyaktig ørebeløp og kan stoppes', () => {
  let options, stopped = false;
  const out = {};
  const js = ts.transpileModule(readFileSync('src/lib/tell.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',js)(name => name === 'motion/react' ? {animate:(from,to,opts)=>{assert.equal(to,1234567.89);options=opts;return{stop(){stopped=true;}};}} : {FJAER:{type:'spring'}},out);
  const el={textContent:''}; const stop=out.tellOpp(el,1234567.89,n=>`${formaterBelop(n)} kr`);
  options.onUpdate(1234567.89); options.onComplete();
  assert.equal(el.textContent,'1 234 567,89 kr'); stop(); assert.equal(stopped,true);
});
