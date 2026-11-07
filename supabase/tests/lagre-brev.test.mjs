// Migrasjon 0026, 0027 og 0028 mot ekte Postgres, med representative gamle data.
// Dekker atomisk lagring, direkte kall, samtidighet, tilgang og fristmodellen.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { byggDatabase, lesMigrasjon, rad, som } from "./hjelp.mjs";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const M = "bbbbbbbb-0000-0000-0000-000000000002";
const SA = "11111111-0000-0000-0000-00000000000a"; // Alice, venter på svar
const SB = "11111111-0000-0000-0000-00000000000b"; // Alice, eldre avsluttet avtale
const SC = "11111111-0000-0000-0000-00000000000c"; // Alice, avsluttet med medhold
const BA = "33333333-0000-0000-0000-00000000000a";
const BB = "33333333-0000-0000-0000-00000000000b";
const F1 = "55555555-0000-0000-0000-000000000001";
const F2 = "55555555-0000-0000-0000-000000000002";
const FB = "55555555-0000-0000-0000-00000000000b";
const FL = "55555555-0000-0000-0000-00000000000c";

let db;
let forMigrasjon;

before(async () => {
  db = await byggDatabase("0025");
  await db.exec(`
    insert into auth.users values ('${A}','a@x'),('${M}','m@x');
    insert into public.saker (id, bruker_id, tittel, status, stadium) values
      ('${SA}','${A}','Alices sak','venter_pa_svar','betalingsoppfordring');
    insert into public.saker (id, bruker_id, tittel, status, stadium, utfall) values
      ('${SB}','${A}','Gammel avtale','fullfort','nedbetaling','nedbetalingsavtale'),
      ('${SC}','${A}','Vunnet sak','fullfort','betalingsoppfordring','medhold');
    insert into public.brev (id, sak_id, bruker_id, original_tekst, forklaring, brevdato) values
      ('${BA}','${SA}','${A}','t','f','2026-10-01'),('${BB}','${SB}','${A}','t','f','2026-05-01');
    insert into public.frister (id, sak_id, bruker_id, tittel, forfallsdato, brev_id) values
      ('${F1}','${SA}','${A}','Svarfrist','2026-10-15','${BA}'),
      ('${F2}','${SA}','${A}','Annen frist','2026-12-01','${BA}'),
      ('${FB}','${SB}','${A}','Avdrag','2026-06-01','${BB}');
    insert into public.frister (id, sak_id, bruker_id, tittel, forfallsdato, fullfort) values
      ('${FL}','${SA}','${A}','Gammel fullført','2026-01-01', true);
  `);
  forMigrasjon = await rad(db, "select count(*)::int n from public.frister");
  // To ganger: migrasjonene skal tåle å kjøres på nytt.
  for (const m of ["0026", "0027", "0028", "0027", "0028"]) await db.exec(lesMigrasjon(m));
});
after(async () => db?.close());

const lagre = (bruker, p) =>
  som(db, bruker, "select public.lagre_brev($1::jsonb) as res", [JSON.stringify(p)]);

/** Alt en lagring kan endre, for å bevise at en feilet lagring ikke endret noe. */
const tilstand = () =>
  rad(db, `select
    (select string_agg(id::text || ':' || status || ':' || coalesce(utfall,'-') || ':' || sist_endret::text, ',' order by id) from public.saker) saker,
    (select count(*)::int from public.brev) brev,
    (select string_agg(id::text || ':' || fullfort::text || ':' || coalesce(erstattet_at::text,'-'), ',' order by id) from public.frister) frister,
    (select count(*)::int from public.neste_steg) steg`);

// Samme form som lagreBrev bygger (src/app/legg-til-brev/actions.ts).
const brev = (over = {}) => ({
  brevdato: "2026-11-05", avsender: "Inkasso AS", avsender_epost: null,
  brevtype: "betalingsoppfordring", belop: 1288, original_tekst: "Brevtekst", forklaring: "Forklaring",
  foreslatte_steg: ["Finn kvitteringen"],
  foreslatte_frister: [{ tittel: "Svarfrist", forfallsdato: "2099-11-19", kilde: "beregnet" }],
  kostnadslinjer: [{ type: "salaer", belop: 800, tekst: "Salær" }],
  gebyrsjekk: { satsGyldigFra: "2026-01-01", linjer: [], antallOver: 0, antallMuligOver: 0 },
  fristfunn: { status: "kun_beregnet", visTittel: "Svarfrist", visForfallsdato: "2099-11-19" },
  alvorlig: false, belop_hovedstol: 488, ...over,
});

async function eksisterende(sakId, over = {}) {
  const s = await rad(db, `select status, sist_endret from public.saker where id = $1`, [sakId]);
  return {
    modus: "eksisterende",
    sak_id: sakId,
    forventet_status: s.status,
    forventet_sist_endret: new Date(s.sist_endret).toISOString(),
    utfall: null,
    avslutning_bekreftet: false,
    gjenapne: false,
    sak: { stadium: "betalingsoppfordring", belop_totalt: 1288 },
    brev: brev(),
    frister: [{ tittel: "Svarfrist", forfallsdato: "2099-11-19", kilde: "beregnet" }],
    erstatter: [],
    steg: ["Finn kvitteringen", "Sjekk nettbanken"],
    ...over,
  };
}

const sak = (id) => rad(db, `select status, utfall, stadium from public.saker where id = $1`, [id]);

// --- Migrasjon over gamle data ---------------------------------------------

test("migrasjonene rører ikke gamle data", async () => {
  const r = await rad(db, `select count(*)::int n, (select fullfort from public.frister where id='${FL}') legacy from public.frister`);
  assert.equal(r.n, forMigrasjon.n);
  assert.equal(r.legacy, true, "fullført frist uten tidspunkt er fortsatt gyldig");
  assert.deepEqual(await sak(SB), { status: "fullfort", utfall: "nedbetalingsavtale", stadium: "nedbetaling" });
});

// --- Feil i hvert steg ruller tilbake alt ------------------------------------

test("feil i hvert lagringstrinn ruller tilbake hele operasjonen", async () => {
  const start = await tilstand();
  const steg = [
    ["oppdatering av saken (ugyldig stadium)", { sak: { stadium: "tull" } }],
    ["brevet (mangler tekst)", { brev: brev({ original_tekst: null }) }],
    ["ny frist (tom tittel)", { frister: [{ tittel: "", forfallsdato: "2099-11-19", kilde: "beregnet" }] }],
    ["erstatning: frist i en annen sak", { erstatter: [FB] }],
    ["erstatning: frist som allerede er lukket", { erstatter: [FL] }],
    ["erstatning: frist som ikke finnes", { erstatter: ["55555555-0000-0000-0000-0000000000ff"] }],
    ["steg (tomt steg)", { steg: ["ok", ""] }],
  ];
  for (const [navn, over] of steg) {
    const r = await lagre(A, await eksisterende(SA, over));
    assert.equal(r.ok, false, navn);
    assert.deepEqual(await tilstand(), start, `${navn}: noe ble lagret likevel`);
  }
  const ny = await lagre(A, {
    modus: "ny", sak: { tittel: "Ny", kreditor: "X" }, brev: brev({ original_tekst: null }),
    frister: [], erstatter: [], steg: [],
  });
  assert.equal(ny.ok, false);
  assert.deepEqual(await tilstand(), start, "ny sak ble opprettet tross feil i brevet");
});

// --- Direkte kall kan ikke omgå reglene --------------------------------------

test("direkte kall kan ikke sette status selv", async () => {
  const start = await tilstand();
  const r = await lagre(A, await eksisterende(SC, { sak: { status: "aktiv" }, frister: [] }));
  assert.equal(r.ok, true, r.feil);
  assert.equal((await sak(SC)).status, "fullfort", "status fra payloaden skal ignoreres");
  assert.notDeepEqual(await tilstand(), start);
});

test("direkte kall kan ikke avslutte uten bekreftelse", async () => {
  const start = await tilstand();
  const r = await lagre(A, await eksisterende(SA, { utfall: "medhold", avslutning_bekreftet: false }));
  assert.match(r.feil ?? "", /MEDHOLD_AVSLUTNING_IKKE_BEKREFTET/);
  assert.deepEqual(await tilstand(), start);
});

test("direkte kall kan ikke åpne en avsluttet sak uten valg, selv med kommende frist", async () => {
  const r = await lagre(A, await eksisterende(SC));
  assert.equal(r.ok, true, r.feil);
  assert.deepEqual(await sak(SC), { status: "fullfort", utfall: "medhold", stadium: "betalingsoppfordring" });
});

test("eksplisitt gjenåpning gjør saken aktiv og beholder utfallet", async () => {
  const r = await lagre(A, await eksisterende(SC, { gjenapne: true }));
  assert.equal(r.ok, true, r.feil);
  assert.deepEqual(await sak(SC), { status: "aktiv", utfall: "medhold", stadium: "betalingsoppfordring" });
});

test("ny sak kan ikke opprettes med utfall", async () => {
  const r = await lagre(A, {
    modus: "ny", utfall: "medhold", sak: { tittel: "Ny", kreditor: "X" }, brev: brev(),
    frister: [], erstatter: [], steg: [],
  });
  assert.match(r.feil ?? "", /MEDHOLD_UGYLDIG_UTFALL/);
});

test("ny sak kan ikke erstatte frister", async () => {
  const r = await lagre(A, {
    modus: "ny", sak: { tittel: "Ny", kreditor: "X" }, brev: brev(), frister: [], erstatter: [F2], steg: [],
  });
  assert.match(r.feil ?? "", /MEDHOLD_FRIST_ERSTATTET/);
  assert.equal((await rad(db, `select fullfort from public.frister where id='${F2}'`)).fullfort, false);
});

// --- Samtidighet og tilgang ----------------------------------------------------

test("lagring med utdatert sist_endret avvises (to faner)", async () => {
  const gammel = await eksisterende(SA);
  // En annen lagring har endret saken etter at denne fanen leste den.
  await db.exec(`update public.saker set saksnummer = 'X1' where id='${SA}'`);
  const start = await tilstand();
  const r = await lagre(A, gammel);
  assert.match(r.feil ?? "", /MEDHOLD_SAK_ENDRET/);
  assert.deepEqual(await tilstand(), start);
});

test("lagring med utdatert status avvises", async () => {
  const r = await lagre(A, await eksisterende(SA, { forventet_status: "aktiv" }));
  assert.match(r.feil ?? "", /MEDHOLD_SAK_ENDRET/);
});

test("to lagringer fra samme utgangspunkt: bare den første går gjennom", async () => {
  const utgangspunkt = await eksisterende(SA);
  const forste = await lagre(A, utgangspunkt);
  const andre = await lagre(A, utgangspunkt);
  assert.equal(forste.ok, true, forste.feil);
  assert.match(andre.feil ?? "", /MEDHOLD_SAK_ENDRET/);
});

test("annen bruker og uinnlogget får ikke lagre", async () => {
  const start = await tilstand();
  assert.match((await lagre(M, await eksisterende(SA))).feil ?? "", /MEDHOLD_FANT_IKKE_SAK/);
  assert.match((await lagre(null, await eksisterende(SA))).feil ?? "", /permission denied/);
  assert.deepEqual(await tilstand(), start);
});

// --- Menyhandlingenes samtidighetsvern mot ekte Postgres ----------------------

// settSakUtfall og gjenapneSak sender sist_endret slik PostgREST leverte den
// (JSON), og oppdaterer med .eq("sist_endret", verdien). Her kjøres samme
// betingede UPDATE i databasen.
test("betinget oppdatering på sist_endret: lik verdi treffer, endret verdi treffer ikke", async () => {
  const lest = await rad(db, `select to_json(sist_endret) #>> '{}' v from public.saker where id = '${SC}'`);
  // En annen fane endrer saken.
  await db.exec(`update public.saker set saksnummer = 'Y2' where id = '${SC}'`);
  const gammel = await som(db, A,
    `update public.saker set utfall = 'avvist' where id = '${SC}' and bruker_id = '${A}' and sist_endret = $1`,
    [lest.v]);
  assert.equal(gammel.rader, 0, "utdatert sist_endret skal ikke treffe");

  const ny = await rad(db, `select to_json(sist_endret) #>> '{}' v from public.saker where id = '${SC}'`);
  const r = await som(db, A,
    `update public.saker set saksnummer = 'Y3' where id = '${SC}' and bruker_id = '${A}' and sist_endret = $1`,
    [ny.v]);
  assert.equal(r.rader, 1, "sist_endret slik PostgREST leverer den skal treffe eksakt");
});

test("betinget fristendring: samme frist kan ikke fullføres to ganger", async () => {
  const sql = `update public.frister set fullfort = true, fullfort_at = now() where id = '${F2}' and bruker_id = '${A}' and fullfort = false`;
  const forste = await som(db, A, sql);
  const andre = await som(db, A, sql);
  assert.equal(forste.rader, 1);
  assert.equal(andre.rader, 0);
  await db.exec(`update public.frister set fullfort = false, fullfort_at = null where id = '${F2}'`);
});

// --- Vellykket lagring ----------------------------------------------------------

test("vellykket lagring: status, brev, ny frist, erstatning og steg", async () => {
  await db.exec(`update public.saker set status = 'venter_pa_svar' where id='${SA}'`);
  const r = await lagre(A, await eksisterende(SA, { erstatter: [F1] }));
  assert.equal(r.ok, true, r.feil);
  const nyttBrev = r.rows[0].res.brev_id;
  const t = await rad(db, `select
    (select status from public.saker where id='${SA}') status,
    (select fullfort from public.frister where id='${F1}') f1,
    (select erstattet_av_brev_id from public.frister where id='${F1}') f1brev,
    (select fullfort from public.frister where id='${F2}') f2,
    (select kostnadslinjer::text from public.brev where id=$1) linjer`, [nyttBrev]);
  assert.equal(t.status, "aktiv", "ventende sak med kommende frist blir aktiv");
  assert.equal(t.f1, true);
  assert.equal(t.f1brev, nyttBrev);
  assert.equal(t.f2, false);
  assert.match(t.linjer, /salaer/);
});

test("akseptert avtale holder saken åpen; oppgjort avslutter", async () => {
  const avtale = await lagre(A, await eksisterende(SA, { utfall: "nedbetalingsavtale", frister: [] }));
  assert.equal(avtale.ok, true, avtale.feil);
  assert.deepEqual(await sak(SA), { status: "aktiv", utfall: "nedbetalingsavtale", stadium: "nedbetaling" });
  const betalt = await lagre(A, await eksisterende(SA, { utfall: "oppgjort", avslutning_bekreftet: true, frister: [] }));
  assert.equal(betalt.ok, true, betalt.feil);
  assert.equal((await sak(SA)).status, "fullfort");
});

// --- Fristmodellen og koblingen til erstatningsbrevet ----------------------------

test("erstatningsbrev fra en annen sak avvises av databasen", async () => {
  const r = await som(db, A, `update public.frister set fullfort = true, erstattet_at = now(), erstattet_av_brev_id = '${BB}' where id = '${F2}'`);
  assert.match(r.feil ?? "", /frister_erstattet_brev_sak_fkey/);
});

test("annen bruker kan ikke sette erstatningsbrev", async () => {
  const r = await som(db, M, `update public.frister set fullfort = true, erstattet_at = now(), erstattet_av_brev_id = '${BA}' where id = '${F2}'`);
  assert.equal(r.rader, 0);
});

test("databasen håndhever fristmodellen", async () => {
  for (const [navn, sql] of [
    ["aktiv frist med fullført-tidspunkt", `update public.frister set fullfort_at = now() where id = '${F2}'`],
    ["både fullført og erstattet", `update public.frister set fullfort = true, fullfort_at = now(), erstattet_at = now() where id = '${F2}'`],
    ["kobling uten erstatningstidspunkt", `update public.frister set fullfort = true, erstattet_av_brev_id = '${BA}' where id = '${F2}'`],
  ]) {
    const r = await som(db, A, sql);
    assert.match(r.feil ?? "", /frister_status_konsistent/, navn);
  }
});

test("slettet erstatningsbrev: koblingen nullstilles, fristen forblir erstattet", async () => {
  const f = await rad(db, `select erstattet_av_brev_id b from public.frister where id='${F1}'`);
  assert.ok(f.b);
  const r = await som(db, A, `delete from public.brev where id = $1`, [f.b]);
  assert.equal(r.ok, true, r.feil);
  const e = await rad(db, `select fullfort, erstattet_at is not null tid, erstattet_av_brev_id from public.frister where id='${F1}'`);
  assert.deepEqual(e, { fullfort: true, tid: true, erstattet_av_brev_id: null });
});

test("kontosletting virker med de nye kolonnene og funksjonene", async () => {
  const r = await som(db, A, "select public.slett_egen_konto()");
  assert.equal(r.ok, true, r.feil);
  assert.equal((await db.query(`select 1 from auth.users where id='${A}'`)).rows.length, 0);
});
