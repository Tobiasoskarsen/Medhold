// Migrasjon 0029, A4: kvoter mot ekte Postgres.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { byggDatabase, lesMigrasjon, rad, som } from "./hjelp.mjs";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const F = (i) => `77777777-0000-0000-0000-${String(i).padStart(12, "0")}`;

let db;
before(async () => {
  db = await byggDatabase("0025");
  await db.exec(`insert into auth.users values ('${A}','a@x'),('${B}','b@x')`);
  for (const m of ["0026", "0027", "0028", "0029", "0029"]) await db.exec(lesMigrasjon(m));
});
after(async () => db?.close());

/** Som serveren: service_role, egen transaksjon. */
async function server(sql, params = []) {
  await db.exec("begin");
  try {
    await db.exec("set local role service_role");
    const r = await db.query(sql, params);
    await db.exec("commit");
    return { ok: true, rows: r.rows };
  } catch (e) {
    await db.exec("rollback");
    return { ok: false, feil: e.message };
  }
}

const reserver = async (krav, forsok = null) =>
  (await server("select public.reserver_kvote($1::jsonb, $2::uuid) r", [JSON.stringify(krav), forsok])).rows[0].r;
const fullfor = async (gruppe, brukt, maling = {}) =>
  (await server("select public.fullfor_kvote($1::uuid, $2, $3::jsonb) r", [gruppe, brukt, JSON.stringify(maling)])).rows[0].r;
const analyse = (bruker) => [{ handling: "dokumentanalyse", nokkel: bruker, bruker_id: bruker }];

test("startkvotene er satt sentralt i tabellen", async () => {
  const r = await db.query("select handling, grense, vindu_sekunder from public.kvoter order by handling");
  assert.deepEqual(
    Object.fromEntries(r.rows.map((x) => [x.handling, [x.grense, x.vindu_sekunder]])),
    {
      chat: [20, 86400],
      dokumentanalyse: [5, 86400],
      innlogging_epost: [5, 3600],
      innlogging_ip: [30, 3600],
      utkast: [3, 86400],
    },
  );
});

test("en justert kvote overskrives ikke når migrasjonen kjøres på nytt", async () => {
  await db.exec("update public.kvoter set grense = 7 where handling = 'chat'");
  await db.exec(lesMigrasjon("0029"));
  assert.equal((await rad(db, "select grense from public.kvoter where handling='chat'")).grense, 7);
  await db.exec("update public.kvoter set grense = 20 where handling = 'chat'");
});

test("fem analyser per døgn, den sjette avvises med tidspunkt for nullstilling", async () => {
  for (let i = 0; i < 5; i++) {
    const r = await reserver(analyse(A));
    assert.equal(r.ok, true);
    assert.equal(r.igjen, 4 - i);
    assert.equal(await fullfor(r.gruppe, true, { modell: "claude-haiku-4-5", inn_tokens: 1200, ut_tokens: 300, ai_kall: 1 }), true);
  }
  const nei = await reserver(analyse(A));
  assert.equal(nei.ok, false);
  assert.equal(nei.grunn, "kvote");
  assert.equal(nei.grense, 5);
  assert.ok(nei.nullstilles);
  // En annen bruker har sin egen kvote.
  assert.equal((await reserver(analyse(B))).ok, true);
});

test("kvoten er rullerende: eldre bruk enn vinduet teller ikke", async () => {
  await db.exec(`update public.kvotebruk set opprettet = now() - interval '25 hours'
    where id = (select min(id) from public.kvotebruk where nokkel = '${A}' and handling = 'dokumentanalyse')`);
  const r = await reserver(analyse(A));
  assert.equal(r.ok, true);
  await fullfor(r.gruppe, true);
  assert.equal((await reserver(analyse(A))).ok, false);
});

test("operasjonelle feil frigir kvoten", async () => {
  const k = [{ handling: "utkast", nokkel: B, bruker_id: B }];
  for (let i = 0; i < 10; i++) {
    const r = await reserver(k);
    assert.equal(r.ok, true, `forsøk ${i}`);
    await fullfor(r.gruppe, false, { feil: "tidsavbrudd" });
  }
  const brukt = await rad(db, `select count(*)::int n from public.kvotebruk where nokkel='${B}' and handling='utkast' and status='frigitt'`);
  assert.equal(brukt.n, 10);
});

test("samtidige reservasjoner kan ikke gå over grensen", async () => {
  // Reservasjoner teller med en gang, før AI-kallet er ferdig.
  const k = [{ handling: "utkast", nokkel: A, bruker_id: A }];
  const svar = [];
  for (let i = 0; i < 6; i++) svar.push(await reserver(k));
  assert.equal(svar.filter((s) => s.ok).length, 3);
  assert.equal(svar.filter((s) => !s.ok && s.grunn === "kvote").length, 3);
});

test("en reservasjon som aldri ble fullført slutter å telle", async () => {
  const k = [{ handling: "chat", nokkel: "krasj", bruker_id: null }];
  await db.exec("update public.kvoter set grense = 1 where handling = 'chat'");
  assert.equal((await reserver(k)).ok, true);
  assert.equal((await reserver(k)).ok, false);
  await db.exec("update public.kvotebruk set opprettet = now() - interval '20 minutes' where nokkel = 'krasj'");
  assert.equal((await reserver(k)).ok, true);
  await db.exec("update public.kvoter set grense = 20 where handling = 'chat'");
});

test("et fullført forsøk kan ikke frigis i ettertid", async () => {
  const r = await reserver([{ handling: "chat", nokkel: B, bruker_id: B }]);
  assert.equal(await fullfor(r.gruppe, true), true);
  assert.equal(await fullfor(r.gruppe, false), false);
  assert.equal((await rad(db, `select status from public.kvotebruk where gruppe = '${r.gruppe}'`)).status, "brukt");
});

test("samme forsøk belastes ikke to ganger", async () => {
  const k = [{ handling: "chat", nokkel: A, bruker_id: A }];
  const forste = await reserver(k, F(1));
  assert.equal(forste.ok, true);
  // Mens det pågår: avvist, ikke belastet.
  const samtidig = await reserver(k, F(1));
  assert.deepEqual([samtidig.ok, samtidig.grunn], [false, "pagar"]);
  await fullfor(forste.gruppe, true);
  // Etterpå: ett gratis nytt forsøk, så må et nytt forsøk startes.
  const igjen = await reserver(k, F(1));
  assert.deepEqual([igjen.ok, igjen.gjentatt, igjen.gruppe], [true, true, forste.gruppe]);
  const tredje = await reserver(k, F(1));
  assert.deepEqual([tredje.ok, tredje.grunn], [false, "gjentatt"]);
  const n = await rad(db, `select count(*)::int n from public.kvotebruk where forsok = '${F(1)}'`);
  assert.equal(n.n, 1);
});

test("et frigitt forsøk kan prøves igjen med samme nøkkel", async () => {
  const k = [{ handling: "chat", nokkel: A, bruker_id: A }];
  const r = await reserver(k, F(2));
  await fullfor(r.gruppe, false, { feil: "nettverk" });
  const igjen = await reserver(k, F(2));
  assert.equal(igjen.ok, true);
  assert.equal(igjen.gjentatt, false);
});

test("et gammelt forsøk med samme innhold gir ikke et gratis nytt", async () => {
  const k = [{ handling: "chat", nokkel: "gammel", bruker_id: null }];
  const r = await reserver(k, F(3));
  await fullfor(r.gruppe, true);
  await db.exec(`update public.kvotebruk set opprettet = now() - interval '2 hours' where gruppe = '${r.gruppe}'`);
  const ny = await reserver(k, F(3));
  assert.deepEqual([ny.ok, ny.gjentatt], [true, false]);
  assert.notEqual(ny.gruppe, r.gruppe);
});

test("innlogging: e-post og IP sjekkes sammen, og avvisning reserverer ingenting", async () => {
  const k = (epost, ip) => [
    { handling: "innlogging_epost", nokkel: epost },
    { handling: "innlogging_ip", nokkel: ip },
  ];
  for (let i = 0; i < 5; i++) {
    const r = await reserver(k("hmac-epost-1", "hmac-ip-1"));
    assert.equal(r.ok, true);
    await fullfor(r.gruppe, true);
  }
  const nei = await reserver(k("hmac-epost-1", "hmac-ip-1"));
  assert.deepEqual([nei.ok, nei.handling], [false, "innlogging_epost"]);
  // En annen e-post fra samme nettverk går fint (delt nettverk).
  assert.equal((await reserver(k("hmac-epost-2", "hmac-ip-1"))).ok, true);
  const ipRader = await rad(db, "select count(*)::int n from public.kvotebruk where nokkel = 'hmac-ip-1'");
  assert.equal(ipRader.n, 6, "den avviste forespørselen skal ikke ha reservert IP-kvote");
});

test("IP-grensen stopper mange e-postadresser fra samme adresse", async () => {
  await db.exec("update public.kvoter set grense = 3 where handling = 'innlogging_ip'");
  for (let i = 0; i < 3; i++) {
    const r = await reserver([{ handling: "innlogging_epost", nokkel: `e${i}` }, { handling: "innlogging_ip", nokkel: "ip-2" }]);
    assert.equal(r.ok, true);
  }
  const nei = await reserver([{ handling: "innlogging_epost", nokkel: "e9" }, { handling: "innlogging_ip", nokkel: "ip-2" }]);
  assert.deepEqual([nei.ok, nei.handling], [false, "innlogging_ip"]);
  await db.exec("update public.kvoter set grense = 30 where handling = 'innlogging_ip'");
});

test("brukere og anonyme kan verken lese, endre eller kalle kvotefunksjonene", async () => {
  for (const bruker of [A, null]) {
    assert.equal((await som(db, bruker, "select * from public.kvoter")).ok, false);
    assert.equal((await som(db, bruker, "select * from public.kvotebruk")).ok, false);
    assert.equal((await som(db, bruker, "update public.kvoter set grense = 1000")).ok, false);
    assert.equal(
      (await som(db, bruker, "select public.reserver_kvote($1::jsonb)", [JSON.stringify(analyse(A))])).ok,
      false,
    );
    assert.equal(
      (await som(db, bruker, "select public.fullfor_kvote(gen_random_uuid(), false)")).ok,
      false,
    );
  }
});

test("målinger tar bare tall og koder", async () => {
  const r = await reserver([{ handling: "chat", nokkel: "maling", bruker_id: null }]);
  const feil = await server("select public.fullfor_kvote($1::uuid, true, $2::jsonb)", [
    r.gruppe,
    JSON.stringify({ feil: "Brevet til Kari Nordmann 01010150074" }),
  ]);
  assert.equal(feil.ok, false);
  assert.equal(await fullfor(r.gruppe, true, { modell: "claude-sonnet-4-5", inn_tokens: 10, ut_tokens: 5, ai_kall: 2, varighet_ms: 812 }), true);
});

test("ugyldig forespørsel og ukjent kvote avvises", async () => {
  assert.match((await server("select public.reserver_kvote('[]'::jsonb)")).feil, /MEDHOLD_UGYLDIG/);
  assert.match((await server(`select public.reserver_kvote('[{"handling":"chat","nokkel":""}]'::jsonb)`)).feil, /MEDHOLD_UGYLDIG/);
  assert.match((await server(`select public.reserver_kvote('[{"handling":"betaling","nokkel":"x"}]'::jsonb)`)).feil, /MEDHOLD_UKJENT_KVOTE/);
});

test("sletting av en bruker sletter bruken deres", async () => {
  await db.exec(`insert into auth.users values ('cccccccc-0000-0000-0000-000000000003','c@x')`);
  const C = "cccccccc-0000-0000-0000-000000000003";
  await reserver([{ handling: "chat", nokkel: C, bruker_id: C }]);
  await db.exec(`delete from auth.users where id = '${C}'`);
  assert.equal((await rad(db, `select count(*)::int n from public.kvotebruk where bruker_id = '${C}'`)).n, 0);
});
