// Statusregelen finnes to steder: statusVedNyttBrev (appen, forhåndsvisning) og
// brev_statusovergang (databasen, det som faktisk lagres). Denne testen kjører
// alle kombinasjoner gjennom begge og krever likt svar.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { byggDatabase, lesMigrasjon, rad, som } from "./hjelp.mjs";
import { statusVedNyttBrev, utfallAvslutter } from "../../src/lib/utfall.ts";
import { vurderBrevdato } from "../../src/lib/brevdato.ts";
import { idagOslo, osloDato } from "../../src/lib/dato.ts";

const STATUSER = ["aktiv", "venter_pa_svar", "fullfort"];
const UTFALL = [null, "medhold", "delvis_medhold", "avvist", "nedbetalingstilbud", "nedbetalingsavtale", "oppgjort"];
const IDAG = "2026-11-10";

let db;
before(async () => {
  db = await byggDatabase("0025");
  await db.exec(lesMigrasjon("0026"));
  await db.exec(lesMigrasjon("0027"));
  await db.exec(lesMigrasjon("0028"));
});
after(async () => db?.close());

/** Det appen ville gjort: bekreftelseskravet i lagreBrev, så statusVedNyttBrev. */
function appensSvar(status, utfall, kommende, gjenapne, bekreftet) {
  if (utfall && utfallAvslutter(utfall) && !bekreftet) return { feil: "MEDHOLD_AVSLUTNING_IKKE_BEKREFTET" };
  const r = statusVedNyttBrev({
    statusNa: status,
    utfall,
    nyeFrister: kommende ? ["2026-11-24"] : [],
    idag: IDAG,
    gjenapne,
  });
  return { status: r.status, stadium: r.stadium ?? null, endreUtfall: r.utfall !== undefined };
}

async function databasensSvar(status, utfall, kommende, gjenapne, bekreftet) {
  try {
    const r = await db.query(
      "select * from public.brev_statusovergang($1, $2, $3, $4, $5)",
      [status, utfall, kommende, gjenapne, bekreftet],
    );
    const x = r.rows[0];
    return { status: x.status, stadium: x.stadium, endreUtfall: x.endre_utfall };
  } catch (e) {
    return { feil: e.message.match(/MEDHOLD_[A-Z_]+/)?.[0] ?? e.message };
  }
}

test("appen og databasen gir samme status for alle kombinasjoner", async () => {
  let antall = 0;
  for (const status of STATUSER)
    for (const utfall of UTFALL)
      for (const kommende of [false, true])
        for (const gjenapne of [false, true])
          for (const bekreftet of [false, true]) {
            const forventet = appensSvar(status, utfall, kommende, gjenapne, bekreftet);
            const faktisk = await databasensSvar(status, utfall, kommende, gjenapne, bekreftet);
            assert.deepEqual(
              faktisk,
              forventet,
              JSON.stringify({ status, utfall, kommende, gjenapne, bekreftet }),
            );
            antall++;
          }
  assert.equal(antall, 3 * 7 * 2 * 2 * 2);
});

test("ukjent utfall avvises av databasen", async () => {
  const r = await databasensSvar("aktiv", "tull", false, false, true);
  assert.equal(r.feil, "MEDHOLD_UGYLDIG_UTFALL");
});

// --- 0032: datoen avgjør om et svar gjør en ventende sak aktiv --------------
// Hele lagre_brev kjøres mot ekte Postgres for hver kombinasjon, og statusen
// som lagres sammenlignes med det statusVedNyttBrev viser i brevflyten.

const A = "aaaaaaaa-0000-0000-0000-0000000000c1";
const EKSISTERENDE = "2026-11-02";
const KOMMENDE = "2099-01-01";
const PASSERT = "2000-01-01";

let db32;
let nr = 0;
before(async () => {
  db32 = await byggDatabase("0025");
  for (const m of ["0026", "0027", "0028", "0029", "0030", "0031", "0032", "0032"]) await db32.exec(lesMigrasjon(m));
  await db32.exec(`insert into auth.users values ('${A}','c@x')`);
});
after(async () => db32?.close());

/** Ny sak som venter på svar, med ett brev og eventuelt et sendt utkast. */
async function ventendeSak(sendtAt) {
  const id = `11111111-0000-0000-0000-${String(++nr).padStart(12, "0")}`;
  await db32.exec(`
    insert into public.saker (id, bruker_id, tittel, status) values ('${id}','${A}','Sak ${nr}','venter_pa_svar');
    insert into public.brev (sak_id, bruker_id, original_tekst, forklaring, brevdato) values ('${id}','${A}','t','f','${EKSISTERENDE}');
  `);
  if (sendtAt) {
    await db32.exec(`insert into public.utkast (sak_id, bruker_id, type, innhold, sendt_at) values ('${id}','${A}','innsigelse','x','${sendtAt}')`);
  }
  return id;
}

async function lagreSvar(sakId, brevdato, frist) {
  const s = await rad(db32, "select status, sist_endret from public.saker where id = $1", [sakId]);
  const r = await som(db32, A, "select public.lagre_brev($1::jsonb) res", [JSON.stringify({
    modus: "eksisterende",
    sak_id: sakId,
    forventet_status: s.status,
    forventet_sist_endret: new Date(s.sist_endret).toISOString(),
    utfall: null,
    avslutning_bekreftet: false,
    gjenapne: false,
    sak: {},
    brev: { brevdato, original_tekst: "Svar", forklaring: "f" },
    frister: frist ? [{ tittel: "Frist", forfallsdato: frist, kilde: "brev_eksplisitt" }] : [],
    erstatter: [],
    steg: [],
  })]);
  assert.equal(r.ok, true, r.feil);
  return (await rad(db32, "select status from public.saker where id = $1", [sakId])).status;
}

function appensStatus(brevdato, frist, sendtAt) {
  return statusVedNyttBrev({
    statusNa: "venter_pa_svar",
    utfall: null,
    nyeFrister: frist ? [frist] : [],
    idag: idagOslo(),
    datovurdering: vurderBrevdato(brevdato, [EKSISTERENDE]),
    brevdato,
    sistSendt: sendtAt ? osloDato(sendtAt) : null,
  }).status;
}

test("0032: appen og lagre_brev gir samme status for alle kombinasjoner", async () => {
  const datoer = [null, "2026-10-01", EKSISTERENDE, "2026-11-05", "2026-11-11", "2026-11-12"];
  const sendt = [null, "2026-11-11T10:00:00Z", "2026-11-10T23:30:00Z"];
  let antall = 0;
  for (const brevdato of datoer)
    for (const frist of [null, PASSERT, KOMMENDE])
      for (const sendtAt of sendt) {
        const faktisk = await lagreSvar(await ventendeSak(sendtAt), brevdato, frist);
        assert.equal(faktisk, appensStatus(brevdato, frist, sendtAt), JSON.stringify({ brevdato, frist, sendtAt }));
        antall++;
      }
  assert.equal(antall, 6 * 3 * 3);
});

test("0032: tilfellene fra Nordkapp-saken", async () => {
  const SENDT = "2026-11-11T09:00:00Z";
  // Samme brev på nytt etter at svaret er sendt.
  assert.equal(await lagreSvar(await ventendeSak(SENDT), EKSISTERENDE, KOMMENDE), "venter_pa_svar");
  // Eldre brev etter sending.
  assert.equal(await lagreSvar(await ventendeSak(SENDT), "2026-10-20", KOMMENDE), "venter_pa_svar");
  // Nytt brev, datert etter at svaret ble sendt, med frist.
  assert.equal(await lagreSvar(await ventendeSak(SENDT), "2026-11-12", KOMMENDE), "aktiv");
  // Brev uten dato, med frist.
  assert.equal(await lagreSvar(await ventendeSak(SENDT), null, KOMMENDE), "aktiv");
  // Nyere brev datert før sending: svaret er alt sendt på det.
  assert.equal(await lagreSvar(await ventendeSak(SENDT), "2026-11-05", KOMMENDE), "venter_pa_svar");
  // Ingen sendt svar: et nyere brev med frist gjør saken aktiv, som før.
  assert.equal(await lagreSvar(await ventendeSak(null), "2026-11-05", KOMMENDE), "aktiv");
  // Sendt 23.30 UTC den 10. er den 11. i norsk tid: et brev datert den 11. venter.
  assert.equal(await lagreSvar(await ventendeSak("2026-11-10T23:30:00Z"), "2026-11-11", KOMMENDE), "venter_pa_svar");
});
