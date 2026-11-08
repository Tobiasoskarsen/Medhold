import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
function last(fil, mocks = {}, cache = new Map()) {
  fil = resolve(fil);
  if (cache.has(fil)) return cache.get(fil);
  const exports = {}; cache.set(fil, exports);
  const js = ts.transpileModule(readFileSync(fil,"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function("require","exports",js)((navn)=>{
    if (Object.hasOwn(mocks,navn)) return mocks[navn];
    if (navn === "server-only") return {};
    let sti = navn.startsWith("@/") ? resolve("src",navn.slice(2)) : navn.startsWith(".") ? resolve(dirname(fil),navn) : null;
    if(sti){if(!existsSync(sti)) sti += existsSync(sti+".ts") ? ".ts" : ".tsx"; return last(sti,mocks,cache);}
    return require(navn);
  },exports);
  return exports;
}
function klient() {
  const rader = {saker:[{id:"sak-a",bruker_id:"a",stadium:"betalingsoppfordring",belop_totalt:10119.5}],brev:[
    {id:"brev-a",sak_id:"sak-a",bruker_id:"a",original_tekst:"TEST",belop:10119.5},
    {id:"brev-b",sak_id:"sak-b",bruker_id:"a",original_tekst:"FEIL SAK"},
    {id:"brev-c",sak_id:"sak-a",bruker_id:"b",original_tekst:"ANNEN BRUKER"}],frister:[]};
  return {auth:{getUser:async()=>({data:{user:{id:"a"}}})},from(tabell){
    let rows=rader[tabell].filter(r=>!r.bruker_id||r.bruker_id==="a");
    const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},order(){return q;},limit(){return q;},maybeSingle:async()=>({data:rows[0]??null}),then(ok){return Promise.resolve({data:rows}).then(ok);}};return q;
  }};
}
const promptFil="src/app/(app)/krav/[id]/utkast/byggUtkastPrompt.ts";
test("R3: autoritativ plan beholder øre og avviser manipulerte forslag før kvote/AI",async()=>{
 const {kontrollerAvdragsforslag:k}=last("src/lib/avdrag-server.ts");
 const gyldig={manedsbelop:600,antallMandeder:17,sisteAvdrag:519.5};
 assert.deepEqual(k(10119.5,gyldig),{ok:true,avdrag:gyldig});
 assert.equal(k(.5,{manedsbelop:.5,antallMandeder:1,sisteAvdrag:.5}).ok,true);
 assert.equal(k(100.25,{manedsbelop:50,antallMandeder:3,sisteAvdrag:.25}).ok,true);
 const ugyldige=[null,0,-1,NaN,Infinity];
 for(const n of ugyldige) assert.equal(k(n,gyldig).ok,false);
 for(const n of [0,-1,NaN,Infinity,600.001]) assert.equal(k(10119.5,{...gyldig,manedsbelop:n}).ok,false);
 for(const n of [0,-1,1.5,NaN,Infinity]) assert.equal(k(10119.5,{...gyldig,antallMandeder:n}).ok,false);
 assert.equal(k(10119.5,{...gyldig,sisteAvdrag:520}).ok,false);
 const db=klient();let kvoter=0,ai=0;
 const mocks={"@/lib/supabase/server":{createClient:async()=>db},"@/lib/plan":{harPluss:async()=>true},"@/lib/kvote-server":{startKvote:async()=>{kvoter++;throw Error("KVOTE");}},"@anthropic-ai/sdk":{default:class{constructor(){ai++;}}}};
 const prompt=last(promptFil,mocks).byggUtkastPrompt;
 const p=await prompt(db,"sak-a","brev-a","nedbetalingsavtale","","Test",gyldig);
 assert.ok(!("feil" in p));assert.ok(p.vaktFakta.tillatteBelop.includes(519.5));
 const route=last("src/app/api/utkast-generer/route.ts",mocks), gammel=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY="test";
 try{for(const avdrag of [{...gyldig,sisteAvdrag:520},{...gyldig,antallMandeder:17.5},"ugyldig"]){
 const r=await route.POST({json:async()=>({kravId:"sak-a",brevId:"brev-a",type:"nedbetalingsavtale",avdrag})});assert.equal(r.status,400);
 }}finally{if(gammel===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=gammel;}
 assert.equal(kvoter,0);assert.equal(ai,0);
});
test("R2: lagret brev overstyrer nyere brev og manipulert URL; manglende brev gir ingen fallback",()=>{
 const {velgUtkastbrev}=last("src/lib/utkastgrunnlag.ts");
 const a={id:"a",avsender:"A",belop:1288},b={id:"b",avsender:"B",belop:9000};
 assert.equal(velgUtkastbrev([b,a],{brev_id:"a"},"b").brev,a);
 assert.deepEqual(velgUtkastbrev([b],{brev_id:"a"},"b"),{brev:null,utilgjengelig:true});
 assert.equal(velgUtkastbrev([b],{brev_id:null},"b").utilgjengelig,true);
 assert.equal(velgUtkastbrev([b],undefined,"feil").utilgjengelig,true);
 assert.equal(velgUtkastbrev([b,a],undefined,undefined).brev,b);
});
test("R1: kun korrekt sak/brev godtas; ugyldig kobling stopper før kvote og AI",async()=>{
  const db=klient(); let kvoter=0, ai=0;
  const mocks={"@/lib/supabase/server":{createClient:async()=>db},"@/lib/plan":{harPluss:async()=>true},"@/lib/kvote-server":{startKvote:async()=>{kvoter++;throw Error("KVOTE");}},"@anthropic-ai/sdk":{default:class{constructor(){ai++;}}}};
  const prompt=last(promptFil,mocks).byggUtkastPrompt;
  assert.ok(!("feil" in await prompt(db,"sak-a","brev-a","innsigelse","","Test")));
  const route=last("src/app/api/utkast-generer/route.ts",mocks);
  const gammel=process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY="lokal-test";
  try{for(const brevId of ["brev-b","brev-c","finnes-ikke","ugyldig"]){
    assert.ok("feil" in await prompt(db,"sak-a",brevId,"innsigelse","","Test"));
    const svar=await route.POST({json:async()=>({kravId:"sak-a",brevId,type:"innsigelse"})});assert.equal(svar.status,404);
  }}finally{if(gammel===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=gammel;}
  assert.equal(kvoter,0);assert.equal(ai,0);
});
