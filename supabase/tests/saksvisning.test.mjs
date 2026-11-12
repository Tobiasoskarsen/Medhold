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
function nodes(n){if(!n)return[];if(Array.isArray(n))return n.flatMap(nodes);if(!n.props)return[];return[n,...['children','oversikt','dokumenter','historikk','forhand'].flatMap(k=>nodes(n.props[k]))];}
function text(n){if(typeof n==='string'||typeof n==='number')return String(n);if(Array.isArray(n))return n.map(text).join('');return text(n?.props?.children??'');}
function panelHarness(){let i=0;const state=[];const props={oversikt:{id:'overview'},dokumenter:{id:'documents'},historikk:{id:'history'},antallDokumenter:3};
 const {Saksvisning}=load('src/app/(app)/krav/[id]/Saksvisning.tsx',{react:{useId:()=> 'case',useState:init=>{const n=i++;if(!(n in state))state[n]=init;return[state[n],v=>state[n]=v];}}});
 return{props,render(){i=0;return Saksvisning(props);}};
}
test('saksvisning viser oversikten først og beholder andre paneler montert, men skjult',()=>{const h=panelHarness();const sections=nodes(h.render()).filter(n=>n.type==='section');assert.equal(sections.length,3);assert.deepEqual(sections.map(n=>n.props.hidden),[false,true,true]);assert.equal(sections[1].props.children,h.props.dokumenter);});
test('dokumenter og historikk kan velges uten ny rute eller tapt panelinnhold',()=>{const h=panelHarness();for(const [i,name]of [[1,'Dokumenter'],[2,'Historikk'],[0,'Oversikt']]){const button=nodes(h.render()).find(n=>n.type==='button'&&text(n).startsWith(name));assert.equal(button.props.type,'button');button.props.onClick();const tree=h.render();const sections=nodes(tree).filter(n=>n.type==='section');assert.equal(sections[i].props.hidden,false);assert.equal(sections[1].props.children,h.props.dokumenter);assert.equal(nodes(tree).find(n=>n.type==='button'&&n.props['aria-pressed']).props['aria-controls'],sections[i].props.id);}});
async function page(status,serious=false,gs=null){
 const sak={id:'case',kreditor:'Syntetisk',tittel:'Test',opprinnelig_kreditor:null,saksnummer:'TEST',belop_totalt:4912.3,stadium:'betalingsoppfordring',status,utfall:null,sist_endret:'2026-11-11T10:00:00Z',hovedstol_avvik:null};
 const rows={brev:[{id:'letter',brevdato:'2026-11-11',brevtype:'betalingsoppfordring',avsender:'Syntetisk',opprettet:'2026-11-11T10:00:00Z',original_tekst:serious?'varsel om tvangsfullbyrdelse':'Syntetisk brev',alvorlig:serious,gebyrsjekk:gs,fristfunn:null}],frister:[],utkast:[{id:'draft',type:'innsigelse',opprettet:'2026-11-11T10:00:00Z',sendt_at:status==='venter_pa_svar'?'2026-11-11T10:00:00Z':null}]};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner',user_metadata:{varsler_paa:false}}}})},from:table=>{const q={select(){return this;},eq(){return this;},order(){return this;},maybeSingle:async()=>({data:table==='saker'?sak:null}),then(fn){return Promise.resolve({data:rows[table]??[]}).then(fn);}};return q;}};
 const mocks={'server-only':{},'@/lib/supabase/server':{createClient:async()=>db},'next/navigation':{notFound(){throw Error('Not found');}},'@/components/ui':Object.fromEntries(['Skjermramme','Primærknapp','StadiumLinje','FristRad','Tidslinje','TidslinjeHendelse','Sekvens','SekvensDel'].map(k=>[k,k])),'@/components/Veivalg':{Veivalg:'Veivalg'},'@/components/Alvorsvarsel':{Alvorsvarsel:'Alvor'},'./VenterPaSvarUtvidelse':{VenterPaSvarUtvidelse:'waiting-controls'}};
 for(const [module,names]of Object.entries({'./LostNode':['LostNode'],'./KravMeny':['KravMeny'],'./MarkerSendtKnapp':['MarkerSendtKnapp'],'./FristKnapp':['FristKnapp'],'./SakensGangSeksjon':['SakensGangSeksjon'],'./KravHeader':['KravNavn','KravBelop'],'@/components/Dom':['DomMiniFrist','DomMiniSum'],'./FunnKort':['FunnKort'],'@/components/ui/Toppstripe':['Toppstripe']}))mocks[module]=Object.fromEntries(names.map(n=>[n,n]));
 return load('src/app/(app)/krav/[id]/page.tsx',mocks).default({params:Promise.resolve({id:'case'}),searchParams:Promise.resolve({})});
}
test('ventende sak prioriterer ventestatus og skjuler generelle veivalg bak Andre muligheter',async()=>{const tree=await page('venter_pa_svar');const detail=nodes(tree).find(n=>n.type==='details'&&text(n).includes('Andre muligheter'));assert.ok(detail);assert.equal(detail.props.open,false);assert.ok(text(nodes(tree).find(n=>n.type==='section'&&n.props['aria-label']==='Venter på svar')).includes('Du venter på svar'));assert.ok(nodes(tree).some(n=>n.type==='Veivalg'));});
test('aktiv sak beholder tilgjengelige valg, og dokumentene peker til eksakte eksisterende ID-er',async()=>{const tree=await page('aktiv');const detail=nodes(tree).find(n=>n.type==='details'&&text(n).includes('Velg neste steg'));assert.equal(detail.props.open,true);const hrefs=nodes(tree).map(n=>n.props.href).filter(Boolean);assert.ok(hrefs.includes('/krav/case/brev/letter'));assert.ok(hrefs.includes('/krav/case/utkast?utkast=draft'));});
test('avsluttet sak får ingen generelle veivalg',async()=>{assert.equal(nodes(await page('fullfort')).filter(n=>n.type==='Veivalg').length,0);});
test('alvorlig sak beholder alvorsvarsel som overstyrer veivalg',async()=>{const ns=nodes(await page('aktiv',true));assert.ok(ns.some(n=>n.type==='Alvor'));assert.equal(ns.filter(n=>n.type==='Veivalg').length,0);});

test('historikken bruker dokumentnavn og egen status for utkast og registrert sendt', async()=>{
 for(const [status,label]of [['aktiv','Utkast – ikke registrert sendt'],['venter_pa_svar','Registrert sendt']]){
  const ns=nodes(await page(status));const entry=ns.find(n=>n.type==='TidslinjeHendelse'&&nodes(n).some(c=>c.props.href==='/krav/case/utkast?utkast=draft'));
  assert.ok(entry);assert.ok(text(entry).includes('Innsigelse'));assert.ok(text(entry).includes(label));assert.ok(!text(entry).includes('Utkast: Innsigelse'));
 }
});

test('sendt-ikonets semantiske farger har minst 3:1 kontrast i begge temaer',()=>{
 const css=readFileSync('src/app/globals.css','utf8');const light=css.slice(css.indexOf(':root {'),css.indexOf('.mork {'));const dark=css.slice(css.indexOf('.mork {'),css.indexOf('@theme inline'));
 const lum=hex=>{const c=hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722};
 for(const block of [light,dark]){const bg=block.match(/--mint:\s*(#[a-f0-9]{6});/i)[1];const fg=block.match(/--mint-tekst:\s*(#[a-f0-9]{6});/i)[1];const a=lum(bg),b=lum(fg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3);}
});

test('Hjem viser ventende saks frist før separat oppfølging uten å endre sakstilstand',async()=>{
 const sak={id:'case',kreditor:'Syntetisk',tittel:'Test',belop_totalt:1288,stadium:'inkassovarsel',status:'venter_pa_svar',sist_endret:'2026-11-11T12:00:00Z'};
 const rows={saker:[sak],frister:[{id:'deadline',sak_id:'case',brev_id:'letter',tittel:'Svarfrist',forfallsdato:'2026-11-22',saker:sak}],brev:[{id:'letter',sak_id:'case',brevdato:'2026-11-08',opprettet:'2026-11-11T12:00:00Z',alvorlig:false}],utkast:[]};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner',user_metadata:{}}}})},from:table=>{const q={select(){return this},eq(){return this},in(){return this},order(){return this},not(){return this},limit(){return this},maybeSingle:async()=>({data:null}),then(fn){return Promise.resolve({data:rows[table]??[]}).then(fn)}};return q}};
 const ui=Object.fromEntries(['Skjermramme','Kort','Primærknapp','Belop','Sekvens','SekvensDel','Heltekort','HeltChip','Snarvei'].map(n=>[n,n]));
 const tree=await load('src/app/(app)/page.tsx',{'@/lib/supabase/server':{createClient:async()=>db},'@/components/ui':ui,'./HjelpKnapp':{HjelpKnapp:'HjelpKnapp'}}).default();
 const card=nodes(tree).find(n=>n.type==='Heltekort'&&n.props.etikett==='Venter på svar');assert.ok(card);const t=text(card);assert.ok(t.includes('Svarfrist'));assert.ok(t.includes('22. november'));assert.ok(t.indexOf('Svarfrist')<t.indexOf('Oppfølgingen er separat'));assert.ok(t.includes('endrer ikke fristen i brevet'));assert.equal(card.props.knapp.props.href,'/legg-til-brev?krav=case');assert.equal(sak.status,'venter_pa_svar');
});

test('R8 Hjem: totalen er aktive og ventende, «Mulig avvik» lenker til saken, og beløpskontrollen skjules aldri',async()=>{
 const s1={id:'s1',kreditor:'Fjelltopp Inkasso',tittel:'A',belop_totalt:3258.9,stadium:'betalingsoppfordring',status:'aktiv',utfall:null,sist_endret:'2026-11-11T12:00:00Z'};
 const s2={id:'s2',kreditor:'Bølgen Kreditt',tittel:'B',belop_totalt:1288,stadium:'inkassovarsel',status:'venter_pa_svar',utfall:null,sist_endret:'2026-11-10T12:00:00Z'};
 const s3={id:'s3',kreditor:'Skogbrukets Finans',tittel:'C',belop_totalt:500,stadium:'betalingsoppfordring',status:'fullfort',utfall:'medhold',sist_endret:'2026-11-09T12:00:00Z'};
 const gs={satsGyldigFra:'2026-01-01',linjer:[{linje:{type:'salaer',belop:900,tekst:''},vurdering:'over',maksLav:null,maksHoy:750,differanse:150,forklaring:''}],antallOver:1,antallMuligOver:0,sumkontroll:{status:'avvik',sum:4812.3,total:4912.3,differanse:100}};
 const rows={saker:[s1,s2,s3],frister:[{id:'f1',sak_id:'s1',brev_id:'b1',tittel:'Svarfrist',forfallsdato:'2099-01-01',saker:s1}],brev:[{id:'b1',sak_id:'s1',brevdato:'2026-11-02',opprettet:'2026-11-11T12:00:00Z',alvorlig:false,gebyrsjekk:gs}],utkast:[]};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner',email:'t@example.com',user_metadata:{brevnavn:'Tobias Oskarsen'}}}})},from:table=>{const q={select(){return this},eq(){return this},in(){return this},order(){return this},not(){return this},limit(){return this},maybeSingle:async()=>({data:null}),then(fn){return Promise.resolve({data:rows[table]??[]}).then(fn)}};return q}};
 const ui=Object.fromEntries(['Skjermramme','Kort','Primærknapp','Belop','Sekvens','SekvensDel','Heltekort'].map(n=>[n,n]));
 const tree=await load('src/app/(app)/page.tsx',{'@/lib/supabase/server':{createClient:async()=>db},'@/components/ui':ui,'./HjelpKnapp':{HjelpKnapp:'HjelpKnapp'}}).default();
 const all=nodes(tree);
 const total=all.find(n=>n.type==='Belop');assert.equal(total.props.verdi,4546.9,'3 258,90 + 1 288 (avsluttet sak er ikke med)');
 const chip=all.find(n=>typeof n.type!=='string'&&n.props.href==='/krav/s1'&&text(n).startsWith('Mulig avvik'));assert.ok(chip,'chip til saken med avviket');assert.ok(text(chip).includes('150 kr'));assert.ok(!/for mye|ulovlig/i.test(text(chip)));
 const card=all.find(n=>n.type==='Heltekort');assert.equal(card.props.etikett,'Trenger oppfølging');assert.equal(card.props.knapp.props.href,'/krav/s1/utkast?type=innsigelse');assert.ok(text(card).includes('Beløpskontroll: 100 kr uten forklaring'));
 assert.ok(!all.some(n=>n.type==='Hurtigrad'));assert.ok(!/Skann|Last opp|Lim inn/.test(text(tree)),'ingen hurtigrad på Hjem');
 assert.ok(!/Hei,|Få hjelp/.test(text(tree)),'ingen hilsen eller ingress');
});

test('R8b Hjem: statuslinjen for frist om 2 dager er «2 dager igjen» uten dato',async()=>{
 const d=new Date(Date.now()+2*864e5+36e5).toISOString().slice(0,10);
 const s1={id:'s1',kreditor:'Fjelltopp Inkasso AS',tittel:'A',belop_totalt:3000,stadium:'betalingsoppfordring',status:'aktiv',utfall:null,sist_endret:'2026-11-11T12:00:00Z'};
 const rows={saker:[s1],frister:[{id:'f1',sak_id:'s1',brev_id:null,tittel:'Svarfrist',forfallsdato:d,saker:s1}],brev:[],utkast:[]};
 const db={auth:{getUser:async()=>({data:{user:{id:'o',email:'t@example.com',user_metadata:{}}}})},from:table=>{const q={select(){return this},eq(){return this},in(){return this},order(){return this},not(){return this},limit(){return this},maybeSingle:async()=>({data:null}),then(fn){return Promise.resolve({data:rows[table]??[]}).then(fn)}};return q}};
 const ui=Object.fromEntries(['Skjermramme','Kort','Primærknapp','Belop','Sekvens','SekvensDel','Heltekort'].map(n=>[n,n]));
 const tree=await load('src/app/(app)/page.tsx',{'@/lib/supabase/server':{createClient:async()=>db},'@/components/ui':ui,'./HjelpKnapp':{HjelpKnapp:'HjelpKnapp'}}).default();
 const st=nodes(tree).find(n=>typeof n.props.status==='string'&&n.props.status.includes('igjen'));assert.ok(st,'statuslinje');assert.equal(st.props.status,'2 dager igjen');
});

const FUNN={satsGyldigFra:'2026-01-01',linjer:[{linje:{type:'salaer',belop:900,tekst:''},vurdering:'over',maksLav:null,maksHoy:750,differanse:150,forklaring:'900 kr overstiger høyeste lovlige salærsats (750 kr) med 150 kr.'}],antallOver:1,antallMuligOver:0,sumkontroll:{status:'avvik',sum:4812.3,total:4912.3,differanse:100}};
test('R8 sak: funnkortet samler gebyrfunn og beløpskontroll, og valgene er knapper i kortet',async()=>{
 const tree=await page('aktiv',false,FUNN);const all=nodes(tree);
 const kort=all.find(n=>n.type==='FunnKort');assert.ok(kort,'funnkortet vises');
 assert.equal(kort.props.visKnapper,true);assert.equal(kort.props.utkastHref,'/krav/case/utkast?type=innsigelse');assert.equal(kort.props.betalHref,'/krav/case/veier-ut');
 assert.equal(kort.props.gebyrsjekk.antallOver,1);
 const barn=nodes(kort.props.children);assert.ok(barn.some(n=>n.type==='DomMiniSum'&&n.props.avvik.differanse===100),'beløpskontrollen skjules aldri');
 assert.ok(!all.some(n=>n.type==='Veivalg'),'Veivalg erstattes av knappene i funnkortet');
});
test('R8 sak: ventende sak med funn har ingen primærknapper i kortet, og valgene ligger bak Andre muligheter',async()=>{
 const tree=await page('venter_pa_svar',false,FUNN);const all=nodes(tree);
 assert.equal(all.find(n=>n.type==='FunnKort').props.visKnapper,false);
 assert.ok(all.some(n=>n.type==='Veivalg'));
});
test('R8 sak: uten funn vises Veivalg som før og ingen funnkort',async()=>{
 const all=nodes(await page('aktiv'));assert.ok(!all.some(n=>n.type==='FunnKort'));assert.ok(all.some(n=>n.type==='Veivalg'));
});

test('R8 Meg: tilbakeknapp, profil, to rad-grupper, Logg ut som eget kort og bunnlinje',async()=>{
 const db={auth:{getUser:async()=>({data:{user:{id:'u',email:'tobias@example.com',identities:[{provider:'email'}],user_metadata:{brevnavn:'Tobias Oskarsen',telefon:'',varsler_paa:true}}}})}};
 const ui=Object.fromEntries(['Skjermramme','Sekvens','SekvensDel'].map(n=>[n,n]));
 const mocks={'@/lib/supabase/server':{createClient:async()=>db},'@/components/ui':ui,'@/components/SlettKonto':{default:'SlettKonto'},'@/components/VarselInnstilling':{default:'Varsel'},'@/components/TilbakeKnapp':{TilbakeKnapp:'Tilbake'},'./TemaRad':{TemaRad:'TemaRad'},'./BrevnavnRad':{BrevnavnRad:'BrevnavnRad'}};
 const tree=await load('src/app/(app)/meg/page.tsx',mocks).default();
 const all=nodes(tree);const t=text(tree);
 assert.ok(all.some(n=>n.type==='Tilbake'));
 assert.ok(t.includes('TO'),'initialene');assert.ok(t.includes('Tobias')&&!t.includes('Oskarsen'),'bare fornavn i hodet');
 const etiketter=all.map(n=>n.props.etikett).filter(Boolean);
 assert.ok(all.some(n=>n.type==='BrevnavnRad'&&n.props.navn==='Tobias Oskarsen'&&n.props.innlogging==='E-postkode'));assert.deepEqual(etiketter,['E-postpåminnelser','Satsene vi bruker','Alle brev','Kontakt support','Personvern og data']);
 assert.ok(all.some(n=>n.type==='TemaRad'));
 assert.ok(!/Innstillinger|Hjelp med|Rediger profil/.test(t));
 const logg=all.find(n=>n.type==='button'&&text(n)==='Logg ut');assert.ok(logg);assert.match(logg.props.className,/text-dom-rod/);
 assert.ok(t.includes('Ikke profesjonell rådgivning'));
});

// En serverkomponent kan ikke sende funksjoner (som ikoner) til en klientkomponent.
// Det ga «Noe gikk galt» på Meg i Preview. Ingen server-side som ikke er markert
// «use client» skal sende ikon-egenskapen til Utvidbar.
test('R8: ingen serverkomponent sender ikon-egenskapen til klientkomponenten Utvidbar',()=>{
 for(const f of ['src/app/(app)/meg/page.tsx','src/app/(app)/krav/[id]/page.tsx','src/app/(app)/page.tsx']){
  const kode=readFileSync(f,'utf8');
  assert.ok(!/<Utvidbar[^>]*ikon=/.test(kode),f+' sender ikon til Utvidbar');
 }
 const brevnavnRad=readFileSync('src/app/(app)/meg/BrevnavnRad.tsx','utf8');assert.ok(brevnavnRad.startsWith('"use client"'));
});
