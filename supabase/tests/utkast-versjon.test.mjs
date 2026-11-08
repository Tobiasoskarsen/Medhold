import { test } from "node:test";
import assert from "node:assert/strict";
import { byggDatabase, lesMigrasjon, som } from "./hjelp.mjs";

test("S1-C: versjonslås, eierskap og uforanderlig sendt tekst", async () => {
  const db = await byggDatabase("0029");
  const a="aaaaaaaa-0000-0000-0000-000000000001", b="bbbbbbbb-0000-0000-0000-000000000002";
  try {
    await db.query("insert into auth.users(id) values ($1),($2)",[a,b]);
    const sak=(await db.query("insert into saker(bruker_id,tittel,status) values ($1,'TEST','aktiv') returning id",[a])).rows[0].id;
    const id=(await db.query("insert into utkast(bruker_id,sak_id,type,innhold) values ($1,$2,'innsigelse','gammel') returning id",[a,sak])).rows[0].id;
    await db.exec(lesMigrasjon("0030"));
    await db.exec(lesMigrasjon("0030"));
    const lagre=(user,v,tekst)=>som(db,user,"update utkast set innhold=$1 where id=$2 and versjon=$3 returning versjon,innhold",[tekst,id,v]);
    assert.equal((await lagre(b,1,"annen bruker")).rader,0);
    assert.equal((await lagre(a,1,"rettet")).rows[0].versjon,2);
    assert.equal((await lagre(a,1,"utdatert fane")).rader,0);
    assert.equal((await som(db,b,"select registrer_utkast_sendt($1,$2)",[id,2])).ok,false);
    assert.equal((await som(db,a,"select registrer_utkast_sendt($1,$2)",[id,1])).ok,false);
    assert.equal((await som(db,a,"select registrer_utkast_sendt($1,$2)",[id,2])).ok,true);
    const r=(await db.query("select innhold,sendt_innhold,versjon from utkast where id=$1",[id])).rows[0];
    assert.equal(r.sendt_innhold,"rettet");
    assert.equal((await db.query("select status from saker where id=$1",[sak])).rows[0].status,"venter_pa_svar");
    await lagre(a,r.versjon,"senere redigering");
    const f=(await db.query("select sendt_innhold from utkast where id=$1",[id])).rows[0];
    assert.equal(f.sendt_innhold,"rettet");
    assert.equal((await som(db,a,"update utkast set sendt_innhold='overskrevet' where id=$1",[id])).ok,false);
  } finally { await db.close(); }
});
