// Migrasjon 0029 mot ekte Postgres: dato-bevisst oppdatering (A2) og
// idempotent lagring (A3). Bygger på 0026–0028 slik de ligger i repoet.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { byggDatabase, lesMigrasjon, rad, som } from "./hjelp.mjs";
import { vurderBrevdato } from "../../src/lib/brevdato.ts";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const M = "bbbbbbbb-0000-0000-0000-000000000002";
const S1 = "11111111-0000-0000-0000-000000000001"; // brev 2026-10-01
const S2 = "11111111-0000-0000-0000-000000000002"; // ett udatert og ett datert brev
const S3 = "11111111-0000-0000-0000-000000000003"; // ingen brev, tomme felt
const N = (i) => `99999999-0000-0000-0000-${String(i).padStart(12, "0")}`;

let db;
let teller = 0;
const nyNokkel = () => N(++teller);

before(async () => {
  db = await byggDatabase("0025");
  await db.exec(`
    insert into auth.users values ('${A}','a@x'),('${M}','m@x');
    insert into public.saker (id, bruker_id, tittel, status, stadium, belop_totalt, saksnummer) values
      ('${S1}','${A}','Sak 1','aktiv','inkassovarsel', 1000, 'GT-1'),
      ('${S2}','${A}','Sak 2','aktiv','inkassovarsel', 2000, 'GT-2');
    insert into public.saker (id, bruker_id, tittel, status) values ('${S3}','${A}','Sak 3','aktiv');
    insert into public.brev (sak_id, bruker_id, original_tekst, forklaring, brevdato) values
      ('${S1}','${A}','t','f','2026-10-01'),
      ('${S2}','${A}','t','f', null),
      ('${S2}','${A}','t','f','2026-06-01');
  `);
  // To ganger: migrasjonene skal tåle å kjøres på nytt.
  for (const m of ["0026", "0027", "0028", "0029", "0029"]) await db.exec(lesMigrasjon(m));
});
after(async () => db?.close());

const lagre = (bruker, p) =>
  som(db, bruker, "select public.lagre_brev($1::jsonb) as res", [JSON.stringify(p)]);

const brev = (brevdato) => ({
  brevdato, avsender: "Inkasso AS", brevtype: "betalingsoppfordring", belop: 1288,
  original_tekst: "Brevtekst", forklaring: "Forklaring", alvorlig: false,
});

async function eksisterende(sakId, brevdato, over = {}) {
  const s = await rad(db, `select status, sist_endret from public.saker where id = $1`, [sakId]);
  return {
    modus: "eksisterende",
    sak_id: sakId,
    forventet_status: s.status,
    forventet_sist_endret: new Date(s.sist_endret).toISOString(),
    utfall: null,
    avslutning_bekreftet: false,
    gjenapne: false,
    sak: { stadium: "betalingsoppfordring", belop_totalt: 1288, saksnummer: "NY-1" },
    brev: brev(brevdato),
    frister: [],
    erstatter: [],
    steg: [],
    nokkel: nyNokkel(),
    ...over,
  };
}

const sak = (id) =>
  rad(db, `select stadium, belop_totalt::float8 belop, saksnummer from public.saker where id = $1`, [id]);
const antall = async (sql) => (await rad(db, sql)).n;

// --- A2: datoregelen ----------------------------------------------------------

test("appen og databasen vurderer brevdatoen likt", async () => {
  const datoer = [null, "2026-09-30", "2026-10-01", "2026-10-02"];
  const saker = [[], ["2026-10-01"], ["2026-10-01", "2026-08-01"], [null], ["2026-10-01", null]];
  for (const ny of datoer) {
    for (const eksisterende of saker) {
      // Samme spørring som lagre_brev: max(brevdato) hopper over null.
      const siste = eksisterende.filter(Boolean).sort().at(-1) ?? null;
      const r = await rad(db, "select public.brev_datovurdering($1::date, $2::date) v", [ny, siste]);
      assert.equal(r.v, vurderBrevdato(ny, eksisterende), JSON.stringify({ ny, eksisterende }));
    }
  }
});

test("eldre brev lagres, men endrer ikke sakens tall", async () => {
  const for_ = await sak(S1);
  const r = await lagre(A, await eksisterende(S1, "2026-09-15"));
  assert.equal(r.ok, true, r.feil);
  assert.equal(r.rows[0].res.datovurdering, "eldre");
  assert.equal(r.rows[0].res.sak_oppdatert, false);
  assert.deepEqual(await sak(S1), for_);
  assert.equal(await antall(`select count(*)::int n from public.brev where sak_id='${S1}' and brevdato='2026-09-15'`), 1);
});

test("brev med samme dato som det nyeste gjetter ikke", async () => {
  const for_ = await sak(S1);
  const r = await lagre(A, await eksisterende(S1, "2026-10-01"));
  assert.equal(r.rows[0].res.datovurdering, "lik");
  assert.deepEqual(await sak(S1), for_);
});

test("brev uten dato gjetter ikke", async () => {
  const for_ = await sak(S1);
  const r = await lagre(A, await eksisterende(S1, null));
  assert.equal(r.rows[0].res.datovurdering, "mangler");
  assert.deepEqual(await sak(S1), for_);
  // Tom streng er også «mangler», aldri dagens dato.
  const t = await lagre(A, await eksisterende(S1, ""));
  assert.equal(t.rows[0].res.datovurdering, "mangler");
  const b = await rad(db, `select brevdato from public.brev where id = $1`, [t.rows[0].res.brev_id]);
  assert.equal(b.brevdato, null);
});

test("udaterte brev i saken teller ikke: sammenligningen er mot de daterte", async () => {
  const for_ = await sak(S2);
  const eldre = await lagre(A, await eksisterende(S2, "2026-05-01"));
  assert.equal(eldre.rows[0].res.datovurdering, "eldre");
  assert.deepEqual(await sak(S2), for_);
  const nyere = await lagre(A, await eksisterende(S2, "2026-07-01", { sak: { belop_totalt: 2500 } }));
  assert.equal(nyere.rows[0].res.datovurdering, "nyest");
  assert.equal((await sak(S2)).belop, 2500);
});

test("nyere brev oppdaterer saken", async () => {
  const r = await lagre(A, await eksisterende(S1, "2026-11-05"));
  assert.equal(r.rows[0].res.datovurdering, "nyest");
  assert.equal(r.rows[0].res.sak_oppdatert, true);
  assert.deepEqual(await sak(S1), { stadium: "betalingsoppfordring", belop: 1288, saksnummer: "NY-1" });
});

test("brukeren kan velge å bruke tallene fra et eldre brev likevel", async () => {
  const r = await lagre(
    A,
    await eksisterende(S1, "2026-01-01", {
      oppdater_sak: true,
      sak: { stadium: "inkassovarsel", belop_totalt: 500, saksnummer: "RETTET" },
    }),
  );
  assert.equal(r.rows[0].res.datovurdering, "eldre");
  assert.equal(r.rows[0].res.sak_oppdatert, true);
  assert.deepEqual(await sak(S1), { stadium: "inkassovarsel", belop: 500, saksnummer: "RETTET" });
});

test("tomme felt fylles også fra et eldre eller udatert brev", async () => {
  const r = await lagre(A, await eksisterende(S3, null));
  assert.equal(r.rows[0].res.datovurdering, "mangler");
  assert.deepEqual(await sak(S3), { stadium: "betalingsoppfordring", belop: 1288, saksnummer: "NY-1" });
});

test("utfall og status følger brukerens valg uavhengig av dato", async () => {
  await db.exec(`update public.saker set status = 'venter_pa_svar' where id = '${S2}'`);
  const r = await lagre(A, await eksisterende(S2, null, { utfall: "avvist" }));
  assert.equal(r.ok, true, r.feil);
  const s = await rad(db, `select status, utfall from public.saker where id='${S2}'`);
  assert.deepEqual(s, { status: "aktiv", utfall: "avvist" });
});

test("ugyldig dato avvises uten at noe lagres", async () => {
  const n = await antall("select count(*)::int n from public.brev");
  const r = await lagre(A, await eksisterende(S1, "2026-13-45"));
  assert.equal(r.ok, false);
  assert.equal(await antall("select count(*)::int n from public.brev"), n);
});

// --- A3: idempotens -----------------------------------------------------------

const telling = () =>
  rad(db, `select (select count(*)::int from public.saker) saker, (select count(*)::int from public.brev) brev,
    (select count(*)::int from public.frister) frister, (select count(*)::int from public.neste_steg) steg,
    (select count(*)::int from public.lagringsforsok) kvitteringer`);

test("samme nøkkel to ganger lager ett brev, og gir samme svar", async () => {
  const p = await eksisterende(S1, "2026-12-10", {
    frister: [{ tittel: "Svarfrist", forfallsdato: "2099-12-24", kilde: "beregnet" }],
    steg: ["Finn kvitteringen"],
  });
  const for_ = await telling();
  const forste = await lagre(A, p);
  assert.equal(forste.ok, true, forste.feil);
  const etter = await telling();
  assert.deepEqual(
    { ...etter },
    { saker: for_.saker, brev: for_.brev + 1, frister: for_.frister + 1, steg: for_.steg + 1, kvitteringer: for_.kvitteringer + 1 },
  );
  // Nytt forsøk med samme nøkkel, selv om sist_endret nå er utdatert.
  const andre = await lagre(A, p);
  assert.equal(andre.ok, true, andre.feil);
  assert.deepEqual(await telling(), etter);
  assert.equal(andre.rows[0].res.brev_id, forste.rows[0].res.brev_id);
  assert.equal(andre.rows[0].res.gjentatt, true);
  assert.equal(forste.rows[0].res.gjentatt, false);
});

test("ny sak med samme nøkkel opprettes bare én gang", async () => {
  const p = {
    modus: "ny", nokkel: nyNokkel(), sak: { tittel: "Ny", kreditor: "X", stadium: "inkassovarsel" },
    brev: brev("2026-11-01"), frister: [], erstatter: [], steg: [],
  };
  const for_ = await telling();
  const r1 = await lagre(A, p);
  const r2 = await lagre(A, p);
  const r3 = await lagre(A, p);
  assert.equal(r1.ok && r2.ok && r3.ok, true);
  const etter = await telling();
  assert.equal(etter.saker, for_.saker + 1);
  assert.equal(etter.brev, for_.brev + 1);
  assert.equal(r3.rows[0].res.sak_id, r1.rows[0].res.sak_id);
});

test("forskjellige dokumenter med hver sin nøkkel lagres begge", async () => {
  const n = await antall("select count(*)::int n from public.brev");
  assert.equal((await lagre(A, await eksisterende(S1, "2026-12-11"))).ok, true);
  assert.equal((await lagre(A, await eksisterende(S1, "2026-12-11"))).ok, true);
  assert.equal(await antall("select count(*)::int n from public.brev"), n + 2);
});

test("et avvist forsøk etterlater ingen kvittering, så samme nøkkel kan prøves igjen", async () => {
  const p = await eksisterende(S1, "2026-12-12", { forventet_sist_endret: "2000-01-01T00:00:00Z" });
  const for_ = await telling();
  const r = await lagre(A, p);
  assert.match(r.feil ?? "", /MEDHOLD_SAK_ENDRET/);
  assert.deepEqual(await telling(), for_);
  const riktig = await eksisterende(S1, "2026-12-12", { nokkel: p.nokkel });
  const igjen = await lagre(A, riktig);
  assert.equal(igjen.ok, true, igjen.feil);
  assert.equal(igjen.rows[0].res.gjentatt, false);
});

test("nøkkelen gjelder per bruker: en annen bruker får ikke Alices resultat", async () => {
  const p = await eksisterende(S1, "2026-12-13");
  assert.equal((await lagre(A, p)).ok, true);
  const mallory = await lagre(M, p);
  assert.equal(mallory.ok, false);
  assert.match(mallory.feil, /MEDHOLD_FANT_IKKE_SAK/);
});

test("kvitteringer: bare egne kan leses, ingen kan endres eller slettes", async () => {
  const egne = await som(db, A, "select count(*)::int n from public.lagringsforsok");
  assert.ok(egne.rows[0].n > 0);
  const andres = await som(db, M, "select count(*)::int n from public.lagringsforsok");
  assert.equal(andres.rows[0].n, 0);
  assert.equal((await som(db, A, "update public.lagringsforsok set resultat = '{}'")).ok, false);
  assert.equal((await som(db, A, "delete from public.lagringsforsok")).ok, false);
  assert.equal((await som(db, null, "select * from public.lagringsforsok")).ok, false);
  // Ingen kan legge inn en falsk kvittering for en annen bruker.
  const falsk = await som(
    db, M,
    `insert into public.lagringsforsok (bruker_id, nokkel, sak_id, resultat) values ('${A}', '${nyNokkel()}', '${S1}', '{}')`,
  );
  assert.equal(falsk.ok, false);
});

test("primærnøkkelen stopper en dobbel kvittering", async () => {
  const k = nyNokkel();
  const sql = `insert into public.lagringsforsok (bruker_id, nokkel, sak_id, resultat) values ('${A}', '${k}', '${S1}', '{}')`;
  assert.equal((await som(db, A, sql)).ok, true);
  assert.match((await som(db, A, sql)).feil, /duplicate key|lagringsforsok_pkey/);
});

test("ugyldig nøkkel avvises", async () => {
  const r = await lagre(A, await eksisterende(S1, "2026-12-14", { nokkel: "ikke-en-uuid" }));
  assert.match(r.feil ?? "", /MEDHOLD_UGYLDIG/);
});

test("uten nøkkel virker lagringen som før (kode som ikke er deployet ennå)", async () => {
  const p = await eksisterende(S1, "2026-12-15");
  delete p.nokkel;
  const r = await lagre(A, p);
  assert.equal(r.ok, true, r.feil);
});

test("sletting av saken tar med kvitteringene", async () => {
  const p = {
    modus: "ny", nokkel: nyNokkel(), sak: { tittel: "Slettes", kreditor: "X" },
    brev: brev("2026-11-01"), frister: [], erstatter: [], steg: [],
  };
  const r = await lagre(A, p);
  const id = r.rows[0].res.sak_id;
  assert.equal((await som(db, A, `delete from public.saker where id = '${id}'`)).ok, true);
  assert.equal(await antall(`select count(*)::int n from public.lagringsforsok where sak_id='${id}'`), 0);
});
