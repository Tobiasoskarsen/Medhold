// Produksjon har kjørt den FØRSTE versjonen av 0026 (fixtures/0026_forste_versjon.sql,
// fra commit ddfdb8a), med enkel fremmednøkkel og constraint-en
// frister_erstattet_er_lukket. Denne testen bekrefter at gjeldende 0026 og 0027
// oppgraderer fra den tilstanden uten tap, med data som i produksjon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { byggDatabase, lesMigrasjon, rad, som } from "./hjelp.mjs";

const FORSTE_0026 = readFileSync("supabase/tests/fixtures/0026_forste_versjon.sql", "utf8");
const KONTROLL = readFileSync("supabase/kontroll/for_0026_0027.sql", "utf8");

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const SV = "11111111-0000-0000-0000-0000000000a1"; // venter på svar
const SF = "11111111-0000-0000-0000-0000000000a2"; // avsluttet avtale med åpen frist
const BV = "33333333-0000-0000-0000-0000000000a1";
const BF = "33333333-0000-0000-0000-0000000000a2";

const konstr = async (db) =>
  (await db.query(
    `select conname from pg_constraint where conrelid = 'public.frister'::regclass order by conname`,
  )).rows.map((r) => r.conname);

test("oppgradering fra første 0026 til gjeldende 0026 og 0027", async () => {
  const db = await byggDatabase("0025");
  await db.exec(FORSTE_0026);
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

  await db.exec(lesMigrasjon("0026"));
  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0026"));
  await db.exec(lesMigrasjon("0027"));

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

  // Den eldre avtalen kan åpnes igjen eller registreres som betalt.
  const apne = await som(db, A, `update public.saker set status = 'aktiv' where id = '${SF}' and status = 'fullfort'`);
  assert.equal(apne.rader, 1);
  await db.close();
});
