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
