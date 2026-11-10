// Opt-in: kun det eksplisitt godkjente testprosjektet. Ingen produksjonsfallback.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const EXPECTED = 'https://evvzxblhaxaraaurbhsu.supabase.co';
if (!process.argv.includes('--run-test-project')) throw Error('Krever --run-test-project');
const env = {};
for (const line of readFileSync('.env.test.local','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*?)\s*$/);
  if (m) { try { env[m[1]] = JSON.parse(m[2]); } catch { env[m[1]] = m[2]; } }
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, EXPECTED, 'Uventet prosjekt, stopp');
assert.ok(env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY, 'Testnøkler mangler');
const options = { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } };
const admin = createClient(EXPECTED,env.SUPABASE_SERVICE_ROLE_KEY,options);
const run = randomUUID();
const appArg=process.argv.find(x=>x.startsWith('--app-url='));
const appUrl=appArg?.slice('--app-url='.length);
if(appUrl && !/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(appUrl))throw Error('Bare lokal test-app er tillatt');
const users = [];
const results = [];
const check = async (id, scenario, fn) => {
  try { const observed=await fn(); results.push({id,scenario,status:'bestått',observed:observed??'forventede assertions bestått'}); }
  catch(e) { results.push({id,scenario,status:'feilet',code:e.code??e.name??'ukjent'}); }
};
function ok(r) { if(r.error) { const e=new Error('Supabase-test feilet'); e.code=r.error.code??String(r.status); throw e; } return r.data; }
async function insert(db,table,value) { return ok(await db.from(table).insert(value).select().single()); }
async function createUser(label) {
  const password=randomBytes(32).toString('base64url');
  const email=`medhold-r2-${run}-${label}@example.com`;
  const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{brevnavn:'R2 syntetisk test'}})).user;
  users.push(user.id);
  const db=createClient(EXPECTED,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
  const signed=ok(await db.auth.signInWithPassword({email,password}));
  const claims=JSON.parse(Buffer.from(signed.session.access_token.split('.')[1],'base64url').toString());
  assert.equal(claims.role,'authenticated'); assert.equal(claims.sub,user.id); assert.equal(claims.iss,EXPECTED+'/auth/v1');
  let cookie='';
  if(appUrl){
    const jar=new Map();
    const ssr=createServerClient(EXPECTED,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
    ok(await ssr.auth.signInWithPassword({email,password}));cookie=[...jar].map(([n,v])=>`${n}=${v}`).join('; ');
  }
  return {id:user.id,db,cookie};
}
let cleanup=true;
try {
  // Ingen bruker opprettes dersom 0030 eller testnøkkelen ikke fungerer.
  ok(await admin.from('utkast').select('id,versjon,sendt_innhold,vakt_fakta').limit(0));
  const A=await createUser('a'),B=await createUser('b');
  await check('RPC-ANON','Uinnlogget bruker mangler execute etter 0031',async()=>{
    const anon=createClient(EXPECTED,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
    assert.equal((await anon.rpc('registrer_utkast_sendt',{p_id:randomUUID(),p_versjon:1})).error?.code,'42501');
  });
  const sak=async(u,n)=>insert(u.db,'saker',{bruker_id:u.id,tittel:`R2-${run}-${n}`,status:'aktiv',stadium:'inkassovarsel',belop_totalt:10119.5});
  const sa=await sak(A,'A1'),sa2=await sak(A,'A2'),sb=await sak(B,'B1');
  const brev=async(u,s,n)=>insert(u.db,'brev',{sak_id:s.id,bruker_id:u.id,brevtype:'inkassovarsel',brevdato:'2026-07-20',avsender:`R2-${n}`,avsender_epost:`r2-${n}@example.invalid`,belop:1288,original_tekst:'Syntetisk testbrev',forklaring:'Syntetisk test'});
  const ba=await brev(A,sa,'A'),ba2=await brev(A,sa2,'A2'),bb=await brev(B,sb,'B');
  const ua=await insert(A.db,'utkast',{sak_id:sa.id,bruker_id:A.id,brev_id:ba.id,type:'innsigelse',innhold:'R2 syntetisk utkast'});
  const ub=await insert(B.db,'utkast',{sak_id:sb.id,bruker_id:B.id,brev_id:bb.id,type:'innsigelse',innhold:'R2 syntetisk utkast'});
  const fa=await insert(A.db,'frister',{sak_id:sa.id,bruker_id:A.id,brev_id:ba.id,tittel:'R2 testfrist',forfallsdato:'2026-12-01',kilde:'brev_eksplisitt'});
  const fb=await insert(B.db,'frister',{sak_id:sb.id,bruker_id:B.id,brev_id:bb.id,tittel:'R2 testfrist',forfallsdato:'2026-12-01',kilde:'brev_eksplisitt'});
  const post=body=>fetch(appUrl+'/api/utkast-generer',{method:'POST',headers:{'Content-Type':'application/json',Cookie:A.cookie},body:JSON.stringify(body),redirect:'manual'});
  if(appUrl)await check('HTTP-SERVER-VALIDATION','Ekte innlogget HTTP avviser feil dokument og avdrag uten kvotebruk',async()=>{
    const before=ok(await admin.from('kvotebruk').select('id').eq('bruker_id',A.id)).length;
    for(const brevId of [ba2.id,bb.id,randomUUID(),null])assert.equal((await post({kravId:sa.id,brevId,type:'innsigelse'})).status,404);
    for(const avdrag of [{manedsbelop:-1,antallMandeder:17,sisteAvdrag:519.5},{manedsbelop:600,antallMandeder:17.5,sisteAvdrag:519.5},{manedsbelop:600,antallMandeder:17,sisteAvdrag:520}])assert.equal((await post({kravId:sa.id,brevId:ba.id,type:'nedbetalingsavtale',avdrag})).status,400);
    assert.equal(ok(await admin.from('kvotebruk').select('id').eq('bruker_id',A.id)).length,before);
    for(const body of [null,[],"tekst",1])assert.equal((await fetch(appUrl+'/api/brev-samtale',{method:'POST',headers:{'Content-Type':'application/json',Cookie:A.cookie},body:JSON.stringify(body)})).status,400);
  });
  for (const [owner,other,s,b,u,f] of [[A,B,sa,ba,ua,fa],[B,A,sb,bb,ub,fb]]) {
    for (const [table,row,change] of [['saker',s,{tittel:'uautorisert'}],['brev',b,{forklaring:'uautorisert'}],['utkast',u,{innhold:'uautorisert'}],['frister',f,{tittel:'uautorisert'}]]) {
      await check(`RLS-${owner===A?'A':'B'}-${table}`, 'Annen bruker SELECT/UPDATE/DELETE', async()=>{
        assert.equal(ok(await other.db.from(table).select('id').eq('id',row.id)).length,0);
        assert.equal(ok(await other.db.from(table).update(change).eq('id',row.id).select('id')).length,0);
        assert.equal(ok(await other.db.from(table).delete().eq('id',row.id).select('id')).length,0);
        assert.equal(ok(await owner.db.from(table).select('id').eq('id',row.id)).length,1);
      });
    }
  }
  await check('RLS-INSERT','INSERT med annen eier/forelder avvises',async()=>{
    for(const value of [{sak_id:sb.id,bruker_id:A.id,brev_id:bb.id},{sak_id:sa.id,bruker_id:B.id,brev_id:ba.id}]){
      const r=await A.db.from('utkast').insert({...value,type:'innsigelse',innhold:'R2 avvist'});assert.ok(r.error);
    }
  });
  await check('RLS-INSERT-ALL','Begge retninger: INSERT på saker/brev/frister/utkast kan ikke bruke annen eier eller sak',async()=>{
    for(const [user,other,otherSak,otherBrev] of [[A,B,sb,bb],[B,A,sa,ba]]){
      const values=[['saker',{bruker_id:other.id,tittel:`R2-${run}-AVVIST`}],['brev',{sak_id:otherSak.id,bruker_id:user.id,original_tekst:'R2 avvist'}],['frister',{sak_id:otherSak.id,bruker_id:user.id,brev_id:otherBrev.id,tittel:'R2 avvist',forfallsdato:'2026-12-01'}],['utkast',{sak_id:otherSak.id,bruker_id:user.id,brev_id:otherBrev.id,type:'innsigelse',innhold:'R2 avvist'}]];
      for(const [table,value] of values)assert.equal((await user.db.from(table).insert(value)).error?.code,'42501');
    }
  });
  await check('RLS-MOVE','Eier kan ikke flytte egne barn til en annen brukers sak',async()=>{
    for(const [table,id] of [['brev',ba.id],['frister',fa.id],['utkast',ua.id]])assert.equal((await A.db.from(table).update({sak_id:sb.id}).eq('id',id)).error?.code,'42501');
  });
  await check('FK-CASE','To egne saker kan ikke få feil brevtilknytning',async()=>{
    const r=await A.db.from('utkast').insert({sak_id:sa.id,bruker_id:A.id,brev_id:ba2.id,type:'innsigelse',innhold:'R2 avvist'});assert.equal(r.error?.code,'23503');
    const f=await A.db.from('frister').insert({sak_id:sa.id,bruker_id:A.id,brev_id:ba2.id,tittel:'R2 avvist',forfallsdato:'2026-12-01'});assert.equal(f.error?.code,'23503');
  });
  await check('RPC-OWNER','Annen bruker kan ikke registrere sendt',async()=>{assert.ok((await B.db.rpc('registrer_utkast_sendt',{p_id:ua.id,p_versjon:ua.versjon})).error);});
  await check('CAS-PARALLEL','To ekte parallelle PATCH med samme versjon',async()=>{
    const r=await Promise.all(['A','B'].map(n=>A.db.from('utkast').update({innhold:`R2 versjon ${n}`}).eq('id',ua.id).eq('versjon',ua.versjon).is('sendt_at',null).select('versjon')));
    assert.deepEqual(r.map(x=>ok(x).length).sort(),[0,1]);
    const current=ok(await A.db.from('utkast').select('versjon').eq('id',ua.id).single());assert.equal(current.versjon,ua.versjon+1);
    return {oppdateringer:1,versjon:current.versjon};
  });
  await check('SEND-PARALLEL','Samtidig redigering og sendt-RPC',async()=>{
    const current=ok(await A.db.from('utkast').select('versjon').eq('id',ua.id).single());
    const [edit,sent]=await Promise.all([A.db.from('utkast').update({innhold:'R2 siste redigering'}).eq('id',ua.id).eq('versjon',current.versjon).is('sendt_at',null).select('versjon'), A.db.rpc('registrer_utkast_sendt',{p_id:ua.id,p_versjon:current.versjon})]);
    const edited=ok(edit).length;assert.equal(edited+(sent.error?0:1),1);
    let row=ok(await A.db.from('utkast').select('innhold,versjon,sendt_at,sendt_innhold').eq('id',ua.id).single());
    if(!row.sendt_at)ok(await A.db.rpc('registrer_utkast_sendt',{p_id:ua.id,p_versjon:row.versjon}));
    row=ok(await A.db.from('utkast').select('innhold,versjon,sendt_at,sendt_innhold').eq('id',ua.id).single());assert.ok(row.sendt_at);assert.equal(row.sendt_innhold,row.innhold);
    assert.ok((await A.db.from('utkast').update({sendt_innhold:'R2 forfalsket'}).eq('id',ua.id)).error);
    assert.equal(ok(await A.db.from('saker').select('status').eq('id',sa.id).single()).status,'venter_pa_svar');
    return {versjon:row.versjon,snapshotStemmer:true};
  });
  const payload=()=>({modus:'ny',nokkel:randomUUID(),sak:{tittel:`R2-${run}-RPC`,kreditor:'R2 TEST',belop_totalt:1288,stadium:'inkassovarsel'},brev:{brevdato:'2026-07-20',avsender:'R2 TEST',brevtype:'inkassovarsel',belop:1288,original_tekst:'R2 syntetisk',forklaring:'R2 test',alvorlig:false},frister:[{tittel:'R2 frist',forfallsdato:'2026-08-03',kilde:'brev_eksplisitt'}],erstatter:[],steg:['R2 teststeg']});
  await check('SAVE-IDEMPOTENT','Parallelle lagre_brev med samme nøkkel og retry',async()=>{
    const p=payload();const r=await Promise.all([A.db.rpc('lagre_brev',{p}),A.db.rpc('lagre_brev',{p})]);const x=r.map(ok);assert.equal(x[0].brev_id,x[1].brev_id);assert.equal(x[0].sak_id,x[1].sak_id);
    assert.equal(ok(await A.db.rpc('lagre_brev',{p})).brev_id,x[0].brev_id);
    assert.equal(ok(await A.db.from('brev').select('id').eq('sak_id',x[0].sak_id)).length,1);assert.equal(ok(await A.db.from('frister').select('id').eq('sak_id',x[0].sak_id)).length,1);
    return {brev:1,frister:1,sammeResultat:true};
  });
  await check('SAVE-ROLLBACK','Sen feil i steginnsetting ruller hele transaksjonen tilbake',async()=>{
    const p=payload();p.sak.tittel=`R2-${run}-ROLLBACK`;p.steg=[null];assert.ok((await A.db.rpc('lagre_brev',{p})).error);
    assert.equal(ok(await A.db.from('saker').select('id').eq('tittel',p.sak.tittel)).length,0);
    assert.equal(ok(await A.db.from('lagringsforsok').select('nokkel').eq('nokkel',p.nokkel)).length,0);
    p.steg=['R2 rettet'];ok(await A.db.rpc('lagre_brev',{p}));
  });
  await check('QUOTA-PRIVILEGES','Bruker kan ikke reservere/frigi kvote via administrative RPC-er',async()=>{
    assert.ok((await A.db.rpc('reserver_kvote',{p_krav:[{handling:'utkast',nokkel:A.id,bruker_id:A.id}],p_forsok:randomUUID()})).error);
    assert.ok((await A.db.rpc('fullfor_kvote',{p_gruppe:randomUUID(),p_brukt:false})).error);
  });
  await check('QUOTA-PARALLEL','Parallelle administrative reservasjoner på syntetisk bruker',async()=>{
    const q=ok(await admin.from('kvoter').select('grense').eq('handling','utkast').single());assert.ok(q.grense>=1&&q.grense<=20);
    const svar=await Promise.all(Array.from({length:q.grense+3},()=>admin.rpc('reserver_kvote',{p_krav:[{handling:'utkast',nokkel:A.id,bruker_id:A.id}],p_forsok:randomUUID()})));
    const rows=svar.map(ok),accepted=rows.filter(x=>x.ok);assert.equal(accepted.length,q.grense);assert.ok(rows.filter(x=>!x.ok).every(x=>x.grunn==='kvote'));
    if(appUrl)assert.equal((await post({kravId:sa.id,brevId:ba.id,type:'innsigelse'})).status,429);
    for(const r of accepted)ok(await admin.rpc('fullfor_kvote',{p_gruppe:r.gruppe,p_brukt:false,p_maling:{feil:'r2_simulert_timeout'}}));
    const retry=ok(await admin.rpc('reserver_kvote',{p_krav:[{handling:'utkast',nokkel:A.id,bruker_id:A.id}],p_forsok:randomUUID()}));assert.equal(retry.ok,true);
    ok(await admin.rpc('fullfor_kvote',{p_gruppe:retry.gruppe,p_brukt:false}));return {grense:q.grense,akseptert:accepted.length,avvist:3,frigittRetry:true};
  });
  if(process.argv.includes('--fault-upstream')){
    assert.equal(appUrl,'http://localhost:3015','Feilinnsprøyting krever den separate lokale feilappen');
    for(const mode of ['TIMEOUT','NETWORK','JSON','TRUNCATED','HANG'])await check(`HTTP-AI-${mode}`,'Kontrollert leverandørfeil: ingen ferdigtekst eller lagring',async()=>{
      const started=Date.now();
      const before=ok(await A.db.from('utkast').select('id').eq('sak_id',sa.id)).length;
      const r=await post({kravId:sa.id,brevId:ba.id,type:'innsigelse',detaljer:`R2FAULT:${mode}`});assert.equal(r.status,200);
      const text=await r.text();assert.ok(text.includes('\u0000__FEIL__\u0000'));assert.ok(!text.includes('\u0000__FERDIG__\u0000'));
      if(mode==='TIMEOUT'||mode==='HANG')assert.ok(text.endsWith('tidsavbrudd'));
      if(mode==='HANG')assert.ok(Date.now()-started>=40_000&&Date.now()-started<59_000,'Må avbrytes før funksjonsgrensen');
      if(mode==='TRUNCATED')assert.ok(text.endsWith('avbrutt'));
      assert.equal(ok(await A.db.from('utkast').select('id').eq('sak_id',sa.id)).length,before);
      const usage=ok(await admin.from('kvotebruk').select('status,feil').eq('bruker_id',A.id));
      assert.ok(!usage.some(x=>x.status==='reservert'));
      return {lagredeUtkast:0,ferdigmarkor:false,reservasjonAvsluttet:true,feilmarkor:true};
    });
  }
} catch(e) {results.push({id:'SETUP',status:'feilet',code:e.code??e.name??'ukjent'});}
finally {
  for(const id of users){
    // Bare denne kjøringens opprettede identiteter, aldri globale reset-kall.
    const q=await admin.from('kvotebruk').delete().eq('bruker_id',id);if(q.error)cleanup=false;
    const r=await admin.auth.admin.deleteUser(id);if(r.error)cleanup=false;
  }
  mkdirSync('docs/testing',{recursive:true});
  const report={prosjekt:'evvzxblhaxaraaurbhsu',tidspunkt:new Date().toISOString(),run,brukerJWT:true,serviceRoleKunOppsettOgAdministrasjon:true,cleanup,results};
  writeFileSync('docs/testing/r2-supabase-resultat.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(!cleanup||results.some(x=>x.status==='feilet'))process.exitCode=1;
}
