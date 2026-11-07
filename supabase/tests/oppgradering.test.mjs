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
