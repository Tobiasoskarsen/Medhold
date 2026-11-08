// Syntetisk lokal nettleserfixture. Ingen produksjonsfallback eller e-post.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const values = {};
for (const line of readFileSync('.env.test.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_0-9]+)=(.*)$/); if(m){try{values[m[1]]=JSON.parse(m[2]);}catch{values[m[1]]=m[2];}}
}
assert.equal(values.NEXT_PUBLIC_SUPABASE_URL,'https://evvzxblhaxaraaurbhsu.supabase.co');
const db=createClient(values.NEXT_PUBLIC_SUPABASE_URL,values.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const file='.env.r3-browser.local';
const ok=r=>{if(r.error)throw Object.assign(new Error('Fixturefeil'),{code:r.error.code});return r.data;};
if(process.argv.includes('--inspect')){
  const fixture=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(fixture.prosjekt,'evvzxblhaxaraaurbhsu');
  const counts={};
  for(const table of ['saker','brev','frister','utkast']){
    const r=await db.from(table).select('id',{count:'exact',head:true}).eq('bruker_id',fixture.user);
    ok(r);counts[table]=r.count;
  }
  const row=ok(await db.from('utkast').select('versjon,innhold,sendt_innhold,sendt_at').eq('id',fixture.utkast).single());
  console.log(JSON.stringify({counts,versjon:row.versjon,sendt:!!row.sendt_at,snapshotStemmer:row.sendt_innhold===row.innhold}));
}else if(process.argv.includes('--cleanup')){
  const fixture=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(fixture.prosjekt,'evvzxblhaxaraaurbhsu');
  ok(await db.auth.admin.deleteUser(fixture.user)); unlinkSync(file);
  console.log('Syntetisk nettleserkonto ryddet.');
}else{
  assert.ok(process.argv.includes('--create'),'Opt-in kreves');
  const email=`r3-browser-${randomUUID()}@example.invalid`;
  const user=ok(await db.auth.admin.createUser({email,email_confirm:true,user_metadata:{brevnavn:'R3 test'}})).user;
  // Lagre cleanup-identitet straks, også hvis en senere fixtureoperasjon feiler.
  const fixture={prosjekt:'evvzxblhaxaraaurbhsu',user:user.id};
  writeFileSync(file,JSON.stringify(fixture));
  const sak=ok(await db.from('saker').insert({bruker_id:user.id,tittel:'R3 syntetisk nettverkstest',status:'aktiv',stadium:'inkassovarsel',belop_totalt:1288}).select('id').single());
  const brev=ok(await db.from('brev').insert({sak_id:sak.id,bruker_id:user.id,avsender:'R3 syntetisk kreditor',avsender_epost:'test@example.invalid',brevtype:'inkassovarsel',brevdato:'2026-11-08',belop:1288,original_tekst:'Syntetisk brev. Å betale 1 288 kr.',forklaring:'Syntetisk nettverkstest.'}).select('id').single());
  const utkast=ok(await db.from('utkast').insert({sak_id:sak.id,bruker_id:user.id,brev_id:brev.id,type:'innsigelse',innhold:'R3 syntetisk testutkast. Jeg ber om dokumentasjon for kravet på 1 288 kr.'}).select('id').single());
  const token=ok(await db.auth.admin.generateLink({type:'magiclink',email})).properties.hashed_token;
  fixture.sak=sak.id;fixture.brev=brev.id;fixture.utkast=utkast.id;
  fixture.path=`/krav/${sak.id}/utkast?utkast=${utkast.id}`;
  fixture.login=`http://localhost:3017/auth/confirm?token_hash=${token}&type=magiclink&next=${encodeURIComponent(fixture.path)}`;
  writeFileSync(file,JSON.stringify(fixture));
  console.log('Syntetisk nettleserfixture opprettet. Engangstoken kun i gitignorert lokal fil.');
}
