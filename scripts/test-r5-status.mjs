// R5 opt-in: actual status action + real user-JWT/PostgREST/RLS, no production fallback.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
if (!process.argv.includes('--run-test-project')) throw Error('Opt-in required');
const env = {};
for (const line of readFileSync('.env.test.local','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_0-9]+)=(.*)$/); if(m){try{env[m[1]]=JSON.parse(m[2]);}catch{env[m[1]]=m[2];}}
}
const url='https://evvzxblhaxaraaurbhsu.supabase.co'; assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,url);
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,options);
const fixture=JSON.parse(readFileSync('.env.r3-browser.local','utf8')); assert.equal(fixture.prosjekt,'evvzxblhaxaraaurbhsu');
const ok=r=>{assert.ok(!r.error,'Test operation failed');return r.data;};
const results=[]; let otherUser; let cleanup=false;
const test=async(name,fn)=>{try{await fn();results.push({name,status:'bestått'});}catch(e){results.push({name,status:'feilet',code:e.code??e.name});}};
const moduleJs=ts.transpileModule(readFileSync('src/app/(app)/krav/[id]/utkast/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function statusAction(client){const out={};new Function('require','exports',moduleJs)(name=>name==='@/lib/supabase/server'?{createClient:async()=>client}:{},out);return out.hentUtkastStatus;}
try{
  const user=ok(await admin.auth.admin.getUserById(fixture.user)).user;
  const token=ok(await admin.auth.admin.generateLink({type:'magiclink',email:user.email})).properties.hashed_token;
  const a=createClient(url,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
  const signed=ok(await a.auth.verifyOtp({token_hash:token,type:'magiclink'}));
  const claims=JSON.parse(Buffer.from(signed.session.access_token.split('.')[1],'base64url').toString());assert.equal(claims.sub,fixture.user);assert.equal(claims.role,'authenticated');
  const email=`r5-rls-${randomUUID()}@example.invalid`, password=randomBytes(32).toString('hex');
  otherUser=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
  const b=createClient(url,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);ok(await b.auth.signInWithPassword({email,password}));
  await test('Own authoritative status returns preserved snapshot',async()=>{const r=await statusAction(a)(fixture.utkast,fixture.sak);assert.equal(r.ok,true);assert.equal(r.sendt,true);const row=ok(await a.from('utkast').select('sendt_innhold').eq('id',fixture.utkast).single());assert.equal(r.tekst,row.sendt_innhold);});
  await test('Wrong case is rejected',async()=>{const r=await statusAction(a)(fixture.utkast,randomUUID());assert.equal(r.ok,false);});
  await test('Other user JWT cannot recover owner draft',async()=>{const r=await statusAction(b)(fixture.utkast,fixture.sak);assert.equal(r.ok,false);assert.equal('tekst' in r,false);});
  await test('Anonymous recovery is rejected',async()=>{const anon=createClient(url,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);assert.equal((await statusAction(anon)(fixture.utkast,fixture.sak)).ok,false);});
  await test('Invalid IDs rejected before query',async()=>{assert.equal((await statusAction(a)('invalid',fixture.sak)).ok,false);});
}finally{
  if(otherUser)ok(await admin.auth.admin.deleteUser(otherUser));cleanup=true;
  const report={project:'evvzxblhaxaraaurbhsu',time:new Date().toISOString(),method:'Actual server module; Next createClient adapter replaced by real authenticated Supabase client. Real PostgREST/RLS, not standalone HTTP action serialization.',serviceRole:'Setup and cleanup only',cleanup,results};
  writeFileSync('docs/testing/r5/status-rls.json',JSON.stringify(report,null,2));
}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='bestått').length,total:results.length,cleanup}));
if(results.some(r=>r.status!=='bestått'))process.exitCode=1;
