import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks, cache = new Map()) {
  file=resolve(file); if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','exports',js)(name=>{
    if(Object.hasOwn(mocks,name))return mocks[name];
    let path=name.startsWith('@/')?resolve('src',name.slice(2)):name.startsWith('.')?resolve(dirname(file),name):null;
    if(!path)return require(name);
    if(!existsSync(path))path+=existsSync(path+'.ts')?'.ts':'.tsx';
    return load(path,mocks,cache);
  },exports);return exports;
}
function harness(actions) {
  const updates=[],pending=[],navigation=[];
  return {updates,pending,navigation,mocks:{
    react:{useState:init=>[typeof init==='function'?init():init,value=>updates.push(value)],useEffect(){},useMemo:fn=>fn(),useTransition:()=>[false,fn=>pending.push(fn())]},
    'next/navigation':{useRouter:()=>({push:url=>navigation.push(url),refresh:()=>navigation.push('refresh')})},
    'motion/react':{m:{div:'div',span:'span'},useReducedMotion:()=>true,AnimatePresence:'div'},
    '@/components/ui':{Kort:'section','Primærknapp':'button'},
    '@/lib/haptikk':{haptikk(){}},
    './actions':actions,'../actions':actions,
  }};
}
function text(node) {if(typeof node==='string')return node;if(Array.isArray(node))return node.map(text).join('');return text(node?.props?.children??'');}
function button(node, label) {
  if(!node)return;
  if(Array.isArray(node)){for(const child of node){const found=button(child,label);if(found)return found;}return;}
  if(node.props?.onClick&&text(node).includes(label))return node;
  return button(node.props?.children,label);
}
for(const outcome of ['network','server'])test(`R3: fristendring ${outcome} beholdes som lokal feil, ikke avvist transition`,async()=>{
  const h=harness({endreFrist:async()=>{if(outcome==='network')throw new TypeError('Failed to fetch');return{ok:false,feil:'Konflikt'};}});
  const tree=load('src/app/(app)/krav/[id]/FristKnapp.tsx',h.mocks).FristKnapp({fristId:'synthetic',handling:'fullfort'});
  button(tree,'Marker fristen som fullført').props.onClick();
  await Promise.all(h.pending);
  assert.deepEqual(h.navigation,[]);
  assert.ok(h.updates.some(x=>typeof x==='string'&&x.includes(outcome==='network'?'Kunne ikke bekrefte fristendringen':'Konflikt')));
});
const props={sakId:'synthetic-sak',brevId:'synthetic-brev',avsender:'Test',avsenderEpost:null,kreditor:'Test',saksnummer:null,starttype:'innsigelse',typeValgt:true,harOverGebyr:false,gebyrDiff:0,ubestridt:null,navnStart:'Test',lagret:{id:'synthetic-utkast',innhold:'Syntetisk tekst.',versjon:1,sendt_at:null,sendt_innhold:null,vakt_fakta:null}};
test('R3: nettverksfeil ved sendt-registrering når ikke React-feilgrensen',async()=>{
  const h=harness({markerUtkastSendt:async()=>{throw new TypeError('Failed to fetch');}});
  const tree=load('src/app/(app)/krav/[id]/utkast/UtkastFlyt.tsx',h.mocks).UtkastFlyt(props);
  button(tree,'Jeg har sendt det').props.onClick(); await Promise.all(h.pending);
  assert.deepEqual(h.navigation,[]);
  assert.ok(h.updates.some(x=>typeof x==='string'&&x.includes('Kunne ikke bekrefte registreringen')));
});
test('R3: vellykket sendt-registrering beholder eksisterende navigasjon',async()=>{
  const h=harness({markerUtkastSendt:async()=>({ok:true,sakId:'synthetic-sak'})});
  const tree=load('src/app/(app)/krav/[id]/utkast/UtkastFlyt.tsx',h.mocks).UtkastFlyt(props);
  button(tree,'Jeg har sendt det').props.onClick(); await Promise.all(h.pending);
  assert.deepEqual(h.navigation,['/krav/synthetic-sak','refresh']);
});
