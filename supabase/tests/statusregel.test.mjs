// Statusregelen finnes to steder: statusVedNyttBrev (appen, forhåndsvisning) og
// brev_statusovergang (databasen, det som faktisk lagres). Denne testen kjører
// alle kombinasjoner gjennom begge og krever likt svar.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { byggDatabase, lesMigrasjon } from "./hjelp.mjs";
import { statusVedNyttBrev, utfallAvslutter } from "../../src/lib/utfall.ts";

const STATUSER = ["aktiv", "venter_pa_svar", "fullfort"];
const UTFALL = [null, "medhold", "delvis_medhold", "avvist", "nedbetalingstilbud", "nedbetalingsavtale", "oppgjort"];
const IDAG = "2026-11-10";

let db;
before(async () => {
  db = await byggDatabase("0025");
  await db.exec(lesMigrasjon("0026"));
  await db.exec(lesMigrasjon("0027"));
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
