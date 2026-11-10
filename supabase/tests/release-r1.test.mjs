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
function klient(ekstra = {}) {
  const rader = {saker:[{id:"sak-a",bruker_id:"a",stadium:"betalingsoppfordring",belop_totalt:10119.5}],brev:[
    {id:"brev-a",sak_id:"sak-a",bruker_id:"a",original_tekst:"TEST",belop:10119.5},
    {id:"brev-b",sak_id:"sak-b",bruker_id:"a",original_tekst:"FEIL SAK"},
    {id:"brev-c",sak_id:"sak-a",bruker_id:"b",original_tekst:"ANNEN BRUKER"}],frister:[],...ekstra};
  return {auth:{getUser:async()=>({data:{user:{id:"a"}}})},from(tabell){
    let rows=rader[tabell].filter(r=>!r.bruker_id||r.bruker_id==="a");
    const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},order(){return q;},limit(){return q;},maybeSingle:async()=>({data:rows[0]??null}),then(ok){return Promise.resolve({data:rows}).then(ok);}};return q;
  }};
}
const promptFil="src/app/(app)/krav/[id]/utkast/byggUtkastPrompt.ts";
test("R2: brevchat avviser null og array som JSON-body uten AI-kall",async()=>{
 let ai=0;
 const route=last("src/app/api/brev-samtale/route.ts",{"@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'a'}}})}})},"@anthropic-ai/sdk":{default:class{constructor(){ai++;}}}});
 for(const body of [null,[],"tekst",1]){
   const r=await route.POST({json:async()=>body});assert.equal(r.status,400);
 }
 assert.equal(ai,0);
});
test("R4: faktisk lagreBrev lagrer serverfunn, manipulasjon krever ny bekreftelse",async()=>{
 const {kontrollerBrevfunn:k}=last("src/lib/brevkontroll.ts");
 const data={brevtype:"inkassovarsel",brevdato:"2026-07-20",original_tekst:"Varsel om tvangssalg",fristIBrevet:{tittel:"Frist",forfallsdato:"2026-07-27"}};
 const funn=k(data);assert.equal(funn.ok,true);assert.equal(funn.alvorlig,true);assert.equal(funn.fristfunn.status,"avvik_kortere");
 assert.equal(k({...data,brevtype:"namsmann"}).fristfunn.status,"kun_eksplisitt");
 assert.equal(k({...data,brevdato:"",fristIBrevet:null}).fristfunn,null);
 for(const brevdato of ["2026-02-30","feil"])assert.equal(k({...data,brevdato}).ok,false);
 assert.equal(k({...data,brevdato:"2020-07-20",fristIBrevet:{tittel:"Frist",forfallsdato:"2020-07-27"}}).fristfunn.beregnetDato,"2020-08-03");
 let payloads=[];
 const db={auth:{getUser:async()=>({data:{user:{id:"a"}}})},rpc:async(_navn,{p})=>{payloads.push(p);return {data:{sak_id:"ny-sak",brev_id:"ny-brev"}};}};
 const {lagreBrev}=last("src/app/legg-til-brev/actions.ts",{"@/lib/supabase/server":{createClient:async()=>db},"next/cache":{revalidatePath(){}},"next/navigation":{redirect(){throw Error("AUTH");}}});
 const input={...data,krav:{modus:"ny",kreditor:"Test"},avsender:"Test",avsender_epost:"",belop:1288,hovedstol:1250,saksnummer:"TEST",forklaring:"ignorer",foreslatte_steg:[],valgteFrister:[],utfall:null,kostnadslinjer:[{type:"purregebyr",belop:38}],fristfunn:funn.fristfunn,alvorlig:true,bekreftet:true,sumStemmerLikevel:false,erstatterFrister:[],avslutningBekreftet:false,gjenapne:false,forventetSistEndret:null,oppdaterSak:false,lagringsnokkel:"11111111-1111-4111-8111-111111111111"};
 const lagretBrev = await lagreBrev(input); assert.equal(lagretBrev.ok,true); assert.equal(lagretBrev.brevId,"ny-brev");
 assert.deepEqual(payloads[0].brev.fristfunn,funn.fristfunn);assert.equal(payloads[0].brev.alvorlig,true);
 for(const over of [{alvorlig:false},{fristfunn:null},{original_tekst:"Et ordinært brev",alvorlig:true}]){
 const r=await lagreBrev({...input,...over});assert.equal(r.ok,false);assert.ok(r.kontroll);}
 assert.equal(payloads.length,1,"ingen lagring ved manipulert vurdering");
});
test("R3: lagreBrev beholder eksplisitt fristkilde også når lovdatoen er lik", async () => {
  const { kontrollerBrevfunn } = last("src/lib/brevkontroll.ts");
  const payloads = [];
  const db = { auth: { getUser: async () => ({ data: { user: { id: "a" } } }) }, rpc: async (_name, { p }) => { payloads.push(p); return { data: { sak_id: "ny-sak", brev_id: "ny-brev" } }; } };
  const { lagreBrev } = last("src/app/legg-til-brev/actions.ts", { "@/lib/supabase/server": { createClient: async () => db }, "next/cache": { revalidatePath() {} }, "next/navigation": { redirect() { throw Error("AUTH"); } } });
  for (const eksplisitt of [true, false]) {
    const data = { brevtype: "inkassovarsel", brevdato: "2026-11-08", original_tekst: "Syntetisk fristtest", fristIBrevet: eksplisitt ? { tittel: "Betalingsfrist", forfallsdato: "2026-11-22" } : null };
    const kontroll = kontrollerBrevfunn(data);
    const input = { ...data, krav: { modus: "ny", kreditor: "Test" }, avsender: "Test", avsender_epost: "", belop: 1288, hovedstol: 1250, saksnummer: "TEST", forklaring: "", foreslatte_steg: [], valgteFrister: [{ tittel: "Betalingsfrist", forfallsdato: "2026-11-22", kilde: "beregnet" }], utfall: null, kostnadslinjer: [{ type: "purregebyr", belop: 38 }], fristfunn: kontroll.fristfunn, alvorlig: kontroll.alvorlig, bekreftet: true, sumStemmerLikevel: false, erstatterFrister: [], avslutningBekreftet: false, gjenapne: false, forventetSistEndret: null, oppdaterSak: false, lagringsnokkel: "11111111-1111-4111-8111-111111111111" };
    assert.equal((await lagreBrev(input)).ok, true);
    const payload = payloads.at(-1);
    assert.equal(payload.frister[0].kilde, eksplisitt ? "brev_eksplisitt" : "beregnet");
    assert.equal(payload.brev.foreslatte_frister[0].kilde, payload.frister[0].kilde);
  }
});

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
test("R2: faktisk UtkastPage bevarer tekst/fakta og mottaker fra eldre brev",async()=>{
 const fakta={omfang:"helt",tillatteBelop:[1288],tillatteDatoer:[],tillatteTokens:[],detaljer:""};
 const lagret={id:"utkast-a",sak_id:"sak-a",bruker_id:"a",brev_id:"brev-a",type:"innsigelse",innhold:"Min redigerte tekst",versjon:2,sendt_at:null,sendt_innhold:null,vakt_fakta:fakta};
 const a={id:"brev-a",sak_id:"sak-a",bruker_id:"a",avsender:"A",avsender_epost:"a@example.invalid",belop:1288},b={id:"brev-b",sak_id:"sak-a",bruker_id:"a",avsender:"B",avsender_epost:"b@example.invalid",belop:9000};
 let brev=[b,a];const db=klient({utkast:[lagret],brev});
 const Flyt=()=>null;
 const page=last("src/app/(app)/krav/[id]/utkast/page.tsx",{"@/lib/supabase/server":{createClient:async()=>db},"@/lib/plan":{harPluss:async()=>true},"next/navigation":{notFound(){throw Error("404");},redirect(){throw Error("AUTH");}},"@/components/ui":{Skjermramme:()=>null},"@/components/ui/Toppstripe":{Toppstripe:()=>null},"@/components/NavLenke":{NavLenke:()=>null},"./UtkastFlyt":{UtkastFlyt:Flyt}}).default;
 const vind=(node)=>{if(!node||typeof node!=="object")return null;if(node.type===Flyt)return node.props;for(const c of [node.props?.children].flat(Infinity)){const f=vind(c);if(f)return f;}return null;};
 const props=vind(await page({params:Promise.resolve({id:"sak-a"}),searchParams:Promise.resolve({utkast:"utkast-a",brev:"brev-b",manedsbelop:"1"})}));
 assert.equal(props.brevId,"brev-a");assert.equal(props.avsender,"A");assert.equal(props.avsenderEpost,"a@example.invalid");assert.equal(props.lagret.innhold,lagret.innhold);assert.deepEqual(props.lagret.vakt_fakta,fakta);assert.equal(props.avdrag,null);
 brev.splice(1,1);
 assert.equal(vind(await page({params:Promise.resolve({id:"sak-a"}),searchParams:Promise.resolve({utkast:"utkast-a",brev:"brev-b"})})),null);
});
test("R1: kun korrekt sak/brev godtas; ugyldig kobling stopper før kvote og AI",async()=>{
  const db=klient(); let kvoter=0, ai=0;
  const mocks={"@/lib/supabase/server":{createClient:async()=>db},"@/lib/plan":{harPluss:async()=>true},"@/lib/kvote-server":{startKvote:async()=>{kvoter++;throw Error("KVOTE");}},"@anthropic-ai/sdk":{default:class{constructor(){ai++;}}}};
  const prompt=last(promptFil,mocks).byggUtkastPrompt;
  assert.ok(!("feil" in await prompt(db,"sak-a","brev-a","innsigelse","","Test")));
  const route=last("src/app/api/utkast-generer/route.ts",mocks);
  const gammel=process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY="lokal-test";
  try{for(const brevId of ["brev-b","brev-c","finnes-ikke","ugyldig",null]){
    assert.ok("feil" in await prompt(db,"sak-a",brevId,"innsigelse","","Test"));
    const svar=await route.POST({json:async()=>({kravId:"sak-a",brevId,type:"innsigelse"})});assert.equal(svar.status,404);
  }}finally{if(gammel===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=gammel;}
  assert.equal(kvoter,0);assert.equal(ai,0);
  assert.ok(!("feil" in await prompt(klient({brev:[]}),"sak-a",null,"innsigelse","","Test")),"manuelt krav uten brev beholder utkastmuligheten");
});
