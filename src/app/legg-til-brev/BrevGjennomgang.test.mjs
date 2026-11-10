import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const js=ts.transpileModule(readFileSync('src/app/legg-til-brev/BrevGjennomgang.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(confirmed=false){
  let index=0; const states=[]; const props={bekreftet:confirmed,opplysninger:'FACTS',kontroll:'CHECKS',handling:'ACTIONS',feil:null,lagrer:false};
  const exports={};new Function('require','exports',js)(name=>name==='react'?{useId:()=> 'heading',useRef:()=>({current:null}),useState:init=>{const i=index++;if(!(i in states))states[i]=init;return[states[i],v=>{states[i]=v;}];}}:name==='@/components/ui'?{'Primærknapp':'button'}:require(name),exports);
  return{props,render(){let tree;for(let i=0;i<3;i++){index=0;tree=exports.BrevGjennomgang(props);}return tree;}};
}
function text(n){if(typeof n==='string'||typeof n==='number')return String(n);if(Array.isArray(n))return n.map(text).join('');return text(n?.props?.children??'');}
function find(n,label){if(!n)return;if(Array.isArray(n)){for(const c of n){const f=find(c,label);if(f)return f;}return;}if(n.props?.onClick&&text(n)===label)return n;return find(n.props?.children,label);}
function click(h,label){const b=find(h.render(),label);assert.ok(b,`missing ${label}`);assert.ok(!b.props.disabled,`disabled ${label}`);b.props.onClick();}
globalThis.requestAnimationFrame=fn=>fn();
test('ingen kontroll eller handlingsvalg før bekreftelse',()=>{const h=harness();const tree=h.render();assert.ok(text(tree).includes('FACTS'));assert.ok(!text(tree).includes('CHECKS'));assert.ok(!text(tree).includes('ACTIONS'));assert.equal(find(tree,'Se kontrollen').props.disabled,true);find(tree,'2Kontroll').props.onClick();assert.ok(text(h.render()).includes('FACTS'));});
test('frem og tilbake beholder innholdet i riktig del uten lagring',()=>{const h=harness(true);click(h,'Se kontrollen');assert.ok(text(h.render()).includes('CHECKS'));assert.ok(!text(h.render()).includes('FACTS'));click(h,'Velg neste steg');assert.ok(text(h.render()).includes('ACTIONS'));click(h,'Tilbake');assert.ok(text(h.render()).includes('CHECKS'));click(h,'Tilbake');assert.ok(text(h.render()).includes('FACTS'));});
test('tilbaketrukket bekreftelse nullstiller fremdriften også etter ny bekreftelse',()=>{const h=harness(true);click(h,'Se kontrollen');click(h,'Velg neste steg');h.props.bekreftet=false;assert.ok(text(h.render()).includes('FACTS'));h.props.bekreftet=true;assert.ok(text(h.render()).includes('FACTS'));assert.ok(!text(h.render()).includes('ACTIONS'));});
test('pågående lagring låser navigasjonen og feil er tilgjengelig',()=>{const h=harness(true);click(h,'Se kontrollen');click(h,'Velg neste steg');h.props.lagrer=true;h.props.feil='Prøv igjen';const tree=h.render();assert.equal(find(tree,'Tilbake').props.disabled,true);assert.ok(text(tree).includes('Lagrer brevet'));assert.ok(text(tree).includes('Prøv igjen'));});
