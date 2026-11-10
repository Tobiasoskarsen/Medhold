// Produksjon har kjørt 0026 (uendret siden, med enkel fremmednøkkel og
// constraint-en frister_erstattet_er_lukket). Denne testen bekrefter at 0027 og
// 0028 oppgraderer fra den tilstanden uten tap. Dataene etterligner det
// produksjonskontrollen viste (antall og kombinasjoner av status og utfall), men
// er ikke en kopi av produksjonsdataene.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { byggDatabase, lesMigrasjon, rad, som } from "./hjelp.mjs";

const KONTROLL = readFileSync("supabase/kontroll/for_0026_0028.sql", "utf8");

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const SV = "11111111-0000-0000-0000-0000000000a1"; // venter på svar
const SF = "11111111-0000-0000-0000-0000000000a2"; // avsluttet avtale med åpen frist
const BV = "33333333-0000-0000-0000-0000000000a1";
const BF = "33333333-0000-0000-0000-0000000000a2";

const konstr = async (db) =>
  (await db.query(
    `select conname from pg_constraint where conrelid = 'public.frister'::regclass order by conname`,
  )).rows.map((r) => r.conname);

test("oppgradering fra 0026 (produksjon) med 0027 og 0028", async () => {
  const db = await byggDatabase("0025");
  await db.exec(lesMigrasjon("0026"));
  // Data som produksjonskontrollen viste: én sak som venter, én avsluttet avtale
  // med én aktiv frist.
  await db.exec(`
    insert into auth.users values ('${A}','a@x');
    insert into public.saker (id, bruker_id, tittel, status) values ('${SV}','${A}','Venter','venter_pa_svar');
    insert into public.saker (id, bruker_id, tittel, status, stadium, utfall) values
      ('${SF}','${A}','Avtale','fullfort','nedbetaling','nedbetalingsavtale');
    insert into public.brev (id, sak_id, bruker_id, original_tekst, forklaring) values
      ('${BV}','${SV}','${A}','t','f'),('${BF}','${SF}','${A}','t','f');
    insert into public.frister (sak_id, bruker_id, tittel, forfallsdato, brev_id) values
      ('${SF}','${A}','Avdrag','2026-12-01','${BF}');
  `);
  const for_ = await konstr(db);
  assert.ok(for_.includes("frister_erstattet_er_lukket"));
  assert.ok(for_.includes("frister_erstattet_av_brev_id_fkey"));
  const data = await rad(db, `select (select count(*)::int from public.frister) f, (select count(*)::int from public.saker) s`);

  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0028"));
  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0028"));

  const etter = await konstr(db);
  assert.ok(!etter.includes("frister_erstattet_er_lukket"), "gammel check skal være borte");
  assert.ok(!etter.includes("frister_erstattet_av_brev_id_fkey"), "gammel enkel nøkkel skal være borte");
  assert.ok(etter.includes("frister_erstattet_brev_sak_fkey"));
  assert.ok(etter.includes("frister_status_konsistent"));

  assert.deepEqual(
    await rad(db, `select (select count(*)::int from public.frister) f, (select count(*)::int from public.saker) s`),
    data,
    "ingen rader skal endres",
  );
  assert.deepEqual(
    await rad(db, `select status, utfall from public.saker where id = '${SF}'`),
    { status: "fullfort", utfall: "nedbetalingsavtale" },
    "avsluttet avtale skal ikke åpnes automatisk",
  );

  // Kontrollen viser forventet tilstand etter oppgradering.
  const k = (await db.query(KONTROLL)).rows;
  const v = (o) => k.find((r) => r.objekt === o)?.verdi;
  assert.equal(v("lagre_brev"), "finnes");
  assert.equal(v("lagre_brev: anon kan kjøre"), "false");
  assert.equal(v("frister: aktive på avsluttede saker"), "1");

  // Den aktive fristen på den avsluttede saken er gyldig etter de nye reglene.
  const f = await som(db, A, `select fullfort, fullfort_at, erstattet_at from public.frister where sak_id = '${SF}'`);
  assert.deepEqual(f.rows, [{ fullfort: false, fullfort_at: null, erstattet_at: null }]);
  await db.close();
});

// Produksjonen kan ha data som ikke ligner testdataene. Bryter en rad de nye
// reglene, skal 0028 stoppe og ikke endre noe, så det kan undersøkes først.
test("0028 stopper uten endringer hvis eksisterende frister bryter reglene", async () => {
  for (const [navn, sql] of [
    ["aktiv frist med fullført-tidspunkt", `update public.frister set fullfort_at = now()`],
    ["fullført og erstattet samtidig", `update public.frister set fullfort = true, fullfort_at = now(), erstattet_at = now()`],
  ]) {
    const db = await byggDatabase("0025");
    await db.exec(lesMigrasjon("0026"));
    await db.exec(`
      insert into auth.users values ('${A}','a@x');
      insert into public.saker (id, bruker_id, tittel, status) values ('${SV}','${A}','Venter','venter_pa_svar');
      insert into public.frister (sak_id, bruker_id, tittel, forfallsdato) values ('${SV}','${A}','Frist','2026-12-01');
    `);
    await db.exec(sql);
    const for_ = await konstr(db);
    let feil = "";
    try {
      await db.exec(lesMigrasjon("0028"));
    } catch (e) {
      feil = e.message;
    }
    await db.exec("rollback").catch(() => {});
    assert.match(feil, /frister_status_konsistent/, navn);
    assert.deepEqual(await konstr(db), for_, `${navn}: ingen constraints skal være endret`);
    await db.close();
  }
});

// 0029 oppå produksjonstilstanden etter 0027 og 0028: endrer ingen rader, og den
// avsluttede avtalen står urørt, også når et eldre brev lagres på den.
test("0029 oppå 0026–0028 endrer ingen data, og avsluttet avtale står urørt", async () => {
  const db = await byggDatabase("0025");
  await db.exec(lesMigrasjon("0026"));
  await db.exec(`
    insert into auth.users values ('${A}','a@x');
    insert into public.saker (id, bruker_id, tittel, status, stadium, utfall, belop_totalt) values
      ('${SF}','${A}','Avtale','fullfort','nedbetaling','nedbetalingsavtale', 4000);
    insert into public.brev (id, sak_id, bruker_id, original_tekst, forklaring, brevdato) values
      ('${BF}','${SF}','${A}','t','f','2026-05-01');
  `);
  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0028"));
  const tilstand = () => rad(db, `select
    (select string_agg(id || status || coalesce(utfall,'') || coalesce(stadium,'') || coalesce(belop_totalt::text,'') || sist_endret::text, ',') from public.saker) saker,
    (select count(*)::int from public.brev) brev, (select count(*)::int from public.frister) frister`);
  const for_ = await tilstand();
  await db.exec(lesMigrasjon("0029"));
  await db.exec(lesMigrasjon("0029"));
  assert.deepEqual(await tilstand(), for_, "0029 skal ikke endre eksisterende rader");

  // Et eldre brev på den avsluttede avtalen: lagres som historikk, saken står.
  const s = await rad(db, `select status, sist_endret from public.saker where id = '${SF}'`);
  const r = await som(db, A, "select public.lagre_brev($1::jsonb) res", [JSON.stringify({
    modus: "eksisterende", sak_id: SF, forventet_status: s.status,
    forventet_sist_endret: new Date(s.sist_endret).toISOString(),
    utfall: null, avslutning_bekreftet: false, gjenapne: false,
    sak: { stadium: "inkassovarsel", belop_totalt: 9999 },
    brev: { brevdato: "2026-01-01", original_tekst: "t", forklaring: "f" },
    frister: [], erstatter: [], steg: [], nokkel: "99999999-0000-0000-0000-0000000000aa",
  })]);
  assert.equal(r.ok, true, r.feil);
  assert.equal(r.rows[0].res.datovurdering, "eldre");
  assert.deepEqual(
    await rad(db, `select status, utfall, stadium, belop_totalt::int b from public.saker where id = '${SF}'`),
    { status: "fullfort", utfall: "nedbetalingsavtale", stadium: "nedbetaling", b: 4000 },
  );
  await db.close();
});

test("0029 stopper før 0027, og en feil midt i migrasjonen ruller tilbake alt", async () => {
  const db = await byggDatabase("0025");
  await db.exec(lesMigrasjon("0026"));
  let feil = "";
  try { await db.exec(lesMigrasjon("0029")); } catch (e) { feil = e.message; }
  await db.exec("rollback").catch(() => {});
  assert.match(feil, /kjør 0027 før 0029/);
  assert.equal((await rad(db, "select to_regclass('public.lagringsforsok') t")).t, null);

  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0028"));
  const lagreFor = (await rad(db, "select md5(prosrc) h from pg_proc where proname = 'lagre_brev'")).h;
  // En tabell med samme navn, men feil form, får innsettingen av kvotene til å feile.
  await db.exec("create table public.kvoter (handling text primary key)");
  feil = "";
  try { await db.exec(lesMigrasjon("0029")); } catch (e) { feil = e.message; }
  await db.exec("rollback").catch(() => {});
  assert.ok(feil, "migrasjonen skulle feilet");
  assert.equal((await rad(db, "select to_regclass('public.lagringsforsok') t")).t, null, "ingen tabeller fra 0029");
  assert.equal((await rad(db, "select md5(prosrc) h from pg_proc where proname = 'lagre_brev'")).h, lagreFor, "lagre_brev er uendret");
  await db.close();
});

test("tilbakeføring av 0029 gir samme lagre_brev som 0027 og bevarer dataene", async () => {
  const db = await byggDatabase("0025");
  for (const m of ["0026", "0027", "0028"]) await db.exec(lesMigrasjon(m));
  const lagre0027 = (await rad(db, "select md5(prosrc) h from pg_proc where proname = 'lagre_brev'")).h;
  await db.exec(lesMigrasjon("0029"));
  await db.exec(`insert into auth.users values ('${A}','a@x');
    insert into public.saker (id, bruker_id, tittel, status) values ('${SV}','${A}','Venter','aktiv');`);
  const r = await som(db, A, "select public.lagre_brev($1::jsonb) res", [JSON.stringify({
    modus: "ny", nokkel: "99999999-0000-0000-0000-0000000000bb", sak: { tittel: "Ny" },
    brev: { brevdato: "2026-11-01", original_tekst: "t", forklaring: "f" }, frister: [], erstatter: [], steg: [],
  })]);
  assert.equal(r.ok, true, r.feil);
  const data = await rad(db, "select (select count(*)::int from public.saker) s, (select count(*)::int from public.brev) b");

  await db.exec(readFileSync("supabase/tilbakeforing/0029_tilbake.sql", "utf8"));
  await db.exec(lesMigrasjon("0027"));
  assert.equal((await rad(db, "select md5(prosrc) h from pg_proc where proname = 'lagre_brev'")).h, lagre0027);
  for (const t of ["lagringsforsok", "kvoter", "kvotebruk"]) {
    assert.equal((await rad(db, `select to_regclass('public.${t}') t`)).t, null, t);
  }
  assert.deepEqual(await rad(db, "select (select count(*)::int from public.saker) s, (select count(*)::int from public.brev) b"), data);
  // Den gamle funksjonen godtar kall fra ny kode (ukjente felt ignoreres).
  const s = await rad(db, `select status, sist_endret from public.saker where id = '${SV}'`);
  const gammel = await som(db, A, "select public.lagre_brev($1::jsonb) res", [JSON.stringify({
    modus: "eksisterende", sak_id: SV, forventet_status: s.status, forventet_sist_endret: new Date(s.sist_endret).toISOString(),
    nokkel: "99999999-0000-0000-0000-0000000000cc", oppdater_sak: true, sak: {},
    brev: { original_tekst: "t", forklaring: "f" }, frister: [], erstatter: [], steg: [],
  })]);
  assert.equal(gammel.ok, true, gammel.feil);
  await db.close();
});
