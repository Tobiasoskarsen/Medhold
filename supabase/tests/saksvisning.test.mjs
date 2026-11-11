import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks,cache=new Map()){
 file=resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',js)(name=>{if(Object.hasOwn(mocks,name))return mocks[name];let p=name.startsWith('@/')?resolve('src',name.slice(2)):name.startsWith('.')?resolve(dirname(file),name):null;if(!p)return require(name);if(!existsSync(p))p+=existsSync(p+'.ts')?'.ts':'.tsx';return load(p,mocks,cache);},out);return out;
}
function nodes(n){if(!n)return[];if(Array.isArray(n))return n.flatMap(nodes);if(!n.props)return[];return[n,...['children','oversikt','dokumenter','historikk'].flatMap(k=>nodes(n.props[k]))];}
function text(n){if(typeof n==='string'||typeof n==='number')return String(n);if(Array.isArray(n))return n.map(text).join('');return text(n?.props?.children??'');}
function panelHarness(){let i=0;const state=[];const props={oversikt:{id:'overview'},dokumenter:{id:'documents'},historikk:{id:'history'},antallDokumenter:3};
 const {Saksvisning}=load('src/app/(app)/krav/[id]/Saksvisning.tsx',{react:{useId:()=> 'case',useState:init=>{const n=i++;if(!(n in state))state[n]=init;return[state[n],v=>state[n]=v];}}});
 return{props,render(){i=0;return Saksvisning(props);}};
}
test('saksvisning viser oversikten først og beholder andre paneler montert, men skjult',()=>{const h=panelHarness();const sections=nodes(h.render()).filter(n=>n.type==='section');assert.equal(sections.length,3);assert.deepEqual(sections.map(n=>n.props.hidden),[false,true,true]);assert.equal(sections[1].props.children,h.props.dokumenter);});
test('dokumenter og historikk kan velges uten ny rute eller tapt panelinnhold',()=>{const h=panelHarness();for(const [i,name]of [[1,'Dokumenter'],[2,'Historikk'],[0,'Oversikt']]){const button=nodes(h.render()).find(n=>n.type==='button'&&text(n).startsWith(name));assert.equal(button.props.type,'button');button.props.onClick();const tree=h.render();const sections=nodes(tree).filter(n=>n.type==='section');assert.equal(sections[i].props.hidden,false);assert.equal(sections[1].props.children,h.props.dokumenter);assert.equal(nodes(tree).find(n=>n.type==='button'&&n.props['aria-pressed']).props['aria-controls'],sections[i].props.id);}});
async function page(status,serious=false){
 const sak={id:'case',kreditor:'Syntetisk',tittel:'Test',opprinnelig_kreditor:null,saksnummer:'TEST',belop_totalt:4912.3,stadium:'betalingsoppfordring',status,utfall:null,sist_endret:'2026-11-11T10:00:00Z',hovedstol_avvik:null};
 const rows={brev:[{id:'letter',brevdato:'2026-11-11',brevtype:'betalingsoppfordring',avsender:'Syntetisk',opprettet:'2026-11-11T10:00:00Z',original_tekst:serious?'varsel om tvangsfullbyrdelse':'Syntetisk brev',alvorlig:serious,gebyrsjekk:null,fristfunn:null}],frister:[],utkast:[{id:'draft',type:'innsigelse',opprettet:'2026-11-11T10:00:00Z',sendt_at:status==='venter_pa_svar'?'2026-11-11T10:00:00Z':null}]};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner',user_metadata:{varsler_paa:false}}}})},from:table=>{const q={select(){return this;},eq(){return this;},order(){return this;},maybeSingle:async()=>({data:table==='saker'?sak:null}),then(fn){return Promise.resolve({data:rows[table]??[]}).then(fn);}};return q;}};
 const mocks={'server-only':{},'@/lib/supabase/server':{createClient:async()=>db},'next/navigation':{notFound(){throw Error('Not found');}},'@/components/ui':Object.fromEntries(['Skjermramme','Primærknapp','StadiumLinje','FristRad','Tidslinje','TidslinjeHendelse','Sekvens','SekvensDel'].map(k=>[k,k])),'@/components/Veivalg':{Veivalg:'Veivalg'},'@/components/Alvorsvarsel':{Alvorsvarsel:'Alvor'},'./VenterPaSvarUtvidelse':{VenterPaSvarUtvidelse:'waiting-controls'}};
 for(const [module,names]of Object.entries({'./LostNode':['LostNode'],'./KravMeny':['KravMeny'],'./MarkerSendtKnapp':['MarkerSendtKnapp'],'./FristKnapp':['FristKnapp'],'./SakensGangSeksjon':['SakensGangSeksjon'],'./KravHeader':['KravNavn','KravBelop'],'@/components/Dom':['DomMini','DomMiniFrist','FunnListe'],'@/components/ui/Toppstripe':['Toppstripe']}))mocks[module]=Object.fromEntries(names.map(n=>[n,n]));
 return load('src/app/(app)/krav/[id]/page.tsx',mocks).default({params:Promise.resolve({id:'case'}),searchParams:Promise.resolve({})});
}
test('ventende sak prioriterer ventestatus og skjuler generelle veivalg bak Andre muligheter',async()=>{const tree=await page('venter_pa_svar');const detail=nodes(tree).find(n=>n.type==='details'&&text(n).includes('Andre muligheter'));assert.ok(detail);assert.equal(detail.props.open,false);assert.ok(text(nodes(tree).find(n=>n.type==='section'&&n.props['aria-label']==='Venter på svar')).includes('Du venter på svar'));assert.ok(nodes(tree).some(n=>n.type==='Veivalg'));});
test('aktiv sak beholder tilgjengelige valg, og dokumentene peker til eksakte eksisterende ID-er',async()=>{const tree=await page('aktiv');const detail=nodes(tree).find(n=>n.type==='details'&&text(n).includes('Velg neste steg'));assert.equal(detail.props.open,true);const hrefs=nodes(tree).map(n=>n.props.href).filter(Boolean);assert.ok(hrefs.includes('/krav/case/brev/letter'));assert.ok(hrefs.includes('/krav/case/utkast?utkast=draft'));});
test('avsluttet sak får ingen generelle veivalg',async()=>{assert.equal(nodes(await page('fullfort')).filter(n=>n.type==='Veivalg').length,0);});
test('alvorlig sak beholder alvorsvarsel som overstyrer veivalg',async()=>{const ns=nodes(await page('aktiv',true));assert.ok(ns.some(n=>n.type==='Alvor'));assert.equal(ns.filter(n=>n.type==='Veivalg').length,0);});
