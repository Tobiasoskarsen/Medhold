import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file){const out={};const js=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',js)(name=>name==='next/image'?{default:'img'}:name.startsWith('@/lib/')?require('../../lib/'+name.slice(6)+'.ts'):require(name),out);return out;}
const {KontrollOversikt}=load('./KontrollOversikt.tsx');
const {BrevReferanse}=load('./BrevReferanse.tsx');
const line=(vurdering,type,belop,forklaring,differanse=null)=>({linje:{type,belop,tekst:''},vurdering,maksLav:null,maksHoy:null,differanse,forklaring});
const result={satsGyldigFra:'2026-01-01',antallOver:1,antallMuligOver:1,linjer:[line('innenfor','purregebyr',38,'Innenfor'),line('over','inkassovarselgebyr',88,'Satsen er overskredet.',50),line('mulig_over','inkassosalaer',1200,'Avhenger av sakstype.'),line('ukjent','rettsgebyr',2045,'Rettsgebyr kontrolleres ikke ennå.')]};
test('oversikten beholder beløp, differanse, tvil og ukontrollerte linjer synlig',()=>{const html=renderToStaticMarkup(KontrollOversikt({resultat:result,children:'FULLSTENDIGE DETALJER'}));const synlig=html.split('<details')[0];assert.match(synlig,/4 kostnadslinjer/);assert.match(synlig,/1 innenfor/);assert.match(synlig,/3 med merknad/);assert.match(synlig,/50 kr over maksimalsats/);assert.match(synlig,/Avhenger av sakstype/);assert.match(synlig,/Rettsgebyr kontrolleres ikke/);assert.match(html,/<details/);assert.doesNotMatch(html,/<details[^>]* open/);assert.match(html,/FULLSTENDIGE DETALJER/);assert.match(synlig,/ikke kontrollert om kostnadene kan kreves samlet/);});
test('manglende kostnadslinjer er ingen friskmelding',()=>{const html=renderToStaticMarkup(KontrollOversikt({resultat:null,children:'SKJULT'}));assert.match(html,/Ingen kostnadslinjer/);assert.match(html,/ikke at kravet er vurdert som riktig/);assert.doesNotMatch(html,/SKJULT/);});
test('antatt brevdato står synlig før gebyrdetaljene',()=>{const html=renderToStaticMarkup(KontrollOversikt({resultat:{...result,brevdatoAntatt:true},children:null}));assert.match(html.split('<details')[0],/Brevet har ingen dato/);});
test('originaltekst behandles som tekst, ikke HTML',()=>{const html=renderToStaticMarkup(BrevReferanse({filer:[],tekst:'<script>ikke kjør</script>'}));assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);});
test('PDF tilbys som lokal nedlasting uten innebygd tredjepartsviser',()=>{const html=renderToStaticMarkup(BrevReferanse({filer:[{media_type:'application/pdf',data:'JVBERi0=',navn:'test.pdf'}],tekst:''}));assert.match(html,/download="test.pdf"/);assert.match(html,/data:application\/pdf;base64,JVBERi0=/);assert.doesNotMatch(html,/<iframe/);});
test('ingen fil eller tekst gir ingen tom dokumenthandling',()=>{assert.equal(BrevReferanse({filer:[],tekst:''}),null);});
