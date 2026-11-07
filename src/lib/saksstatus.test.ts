import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fristStatus,
  gjenapneSak,
  lagreBrevFeilmelding,
  settFristStatus,
  settSakUtfall,
} from "./saksstatus.ts";

const ALICE = "alice";
const MALLORY = "mallory";
const NA = "2026-11-10T12:00:00.000Z";

type Rad = Record<string, unknown>;

/** Minimal Supabase-klient som filtrerer og oppdaterer rader i minnet. */
function fakeDb(tabeller: Record<string, Rad[]>, feilVedUpdate = false) {
  return {
    from(tabell: string) {
      const rader = tabeller[tabell] ?? [];
      let filtre: ((r: Rad) => boolean)[] = [];
      let endring: Rad | null = null;
      const kjor = () => {
        const treff = rader.filter((r) => filtre.every((f) => f(r)));
        if (endring) for (const r of treff) Object.assign(r, endring);
        return treff;
      };
      const q = {
        select() {
          return q;
        },
        update(e: Rad) {
          endring = e;
          return q;
        },
        eq(k: string, v: unknown) {
          filtre = [...filtre, (r) => r[k] === v];
          return q;
        },
        in(k: string, v: unknown[]) {
          filtre = [...filtre, (r) => v.includes(r[k])];
          return q;
        },
        maybeSingle: async () => ({ data: kjor()[0] ?? null, error: null }),
        then(res: (v: { data: Rad[] | null; error: unknown }) => void) {
          if (endring && feilVedUpdate) return res({ data: null, error: { message: "feil" } });
          return res({ data: kjor(), error: null });
        },
      };
      return q;
    },
  } as never;
}

const data = () => ({
  saker: [
    { id: "sA", bruker_id: ALICE, status: "venter_pa_svar", utfall: null, stadium: "inkassovarsel" } as Rad,
  ],
  frister: [
    { id: "f1", sak_id: "sA", bruker_id: ALICE, fullfort: false, fullfort_at: null, erstattet_at: null, erstattet_av_brev_id: null } as Rad,
    { id: "f2", sak_id: "sA", bruker_id: ALICE, fullfort: false, fullfort_at: null, erstattet_at: null, erstattet_av_brev_id: null } as Rad,
  ],
});

// --- Tilgang ---

test("statusendring på en annens sak avvises, og saken er urørt", async () => {
  const d = data();
  const r = await settSakUtfall(fakeDb(d), MALLORY, "sA", "medhold", true);
  assert.deepEqual(r, { ok: false, feil: "Fant ikke saken." });
  assert.equal(d.saker[0].status, "venter_pa_svar");
  assert.equal(d.saker[0].utfall, null);
});

test("endring av en annens frist avvises, og fristen er urørt", async () => {
  const d = data();
  const r = await settFristStatus(fakeDb(d), MALLORY, "f1", "fullfort", NA);
  assert.equal(r.ok, false);
  assert.equal(d.frister[0].fullfort, false);
});

test("sak som ikke finnes gir feil", async () => {
  const r = await settSakUtfall(fakeDb(data()), ALICE, "finnes-ikke", "avvist", false);
  assert.equal(r.ok, false);
});

test("gjenåpning av en annens sak avvises", async () => {
  const d = data();
  d.saker[0].status = "fullfort";
  const r = await gjenapneSak(fakeDb(d), MALLORY, "sA");
  assert.equal(r.ok, false);
  assert.equal(d.saker[0].status, "fullfort");
});

// --- Avslutning krever bekreftelse ---

test("utfall som avslutter uten bekreftelse avvises", async () => {
  for (const u of ["medhold", "oppgjort", null] as const) {
    const d = data();
    const r = await settSakUtfall(fakeDb(d), ALICE, "sA", u, false);
    assert.deepEqual(r, { ok: false, feil: "Bekreft at saken skal avsluttes." }, String(u));
    assert.equal(d.saker[0].status, "venter_pa_svar");
  }
});

test("avslutning med bekreftelse lagres", async () => {
  const d = data();
  assert.deepEqual(await settSakUtfall(fakeDb(d), ALICE, "sA", "medhold", true), { ok: true });
  assert.equal(d.saker[0].status, "fullfort");
  assert.equal(d.saker[0].utfall, "medhold");
});

test("«vet ikke» med bekreftelse avslutter og tømmer et gammelt utfall", async () => {
  const d = data();
  d.saker[0].utfall = "avvist";
  await settSakUtfall(fakeDb(d), ALICE, "sA", null, true);
  assert.equal(d.saker[0].status, "fullfort");
  assert.equal(d.saker[0].utfall, null);
});

test("akseptert avtale holder saken åpen med stadium nedbetaling", async () => {
  const d = data();
  assert.deepEqual(await settSakUtfall(fakeDb(d), ALICE, "sA", "nedbetalingsavtale", false), { ok: true });
  assert.equal(d.saker[0].status, "aktiv");
  assert.equal(d.saker[0].stadium, "nedbetaling");
});

test("delvis medhold, avvist og tilbud holder saken åpen uten bekreftelse", async () => {
  for (const u of ["delvis_medhold", "avvist", "nedbetalingstilbud"] as const) {
    const d = data();
    assert.deepEqual(await settSakUtfall(fakeDb(d), ALICE, "sA", u, false), { ok: true });
    assert.equal(d.saker[0].status, "aktiv", u);
    assert.equal(d.saker[0].utfall, u);
  }
});

test("ukjent utfall avvises", async () => {
  const d = data();
  const r = await settSakUtfall(fakeDb(d), ALICE, "sA", "tull" as never, true);
  assert.equal(r.ok, false);
  assert.equal(d.saker[0].status, "venter_pa_svar");
});

test("databasefeil gir feilmelding, ikke stille suksess", async () => {
  const r = await settSakUtfall(fakeDb(data(), true), ALICE, "sA", "avvist", false);
  assert.deepEqual(r, { ok: false, feil: "Kunne ikke lagre. Prøv igjen." });
});

// --- Frister ---

test("frist kan fullføres og angres, og raden beholdes", async () => {
  const d = data();
  const r = await settFristStatus(fakeDb(d), ALICE, "f1", "fullfort", NA);
  assert.equal(r.ok, true);
  assert.equal(r.sakId, "sA");
  assert.equal(fristStatus(d.frister[0] as never), "fullfort");
  assert.equal(d.frister[0].fullfort_at, NA);
  assert.equal(d.frister.length, 2);

  await settFristStatus(fakeDb(d), ALICE, "f1", "aktiv", NA);
  assert.equal(fristStatus(d.frister[0] as never), "aktiv");
  assert.equal(d.frister[0].fullfort_at, null);
});

test("gjenåpning beholder utfallet som historikk", async () => {
  const d = data();
  d.saker[0].status = "fullfort";
  d.saker[0].utfall = "medhold";
  assert.deepEqual(await gjenapneSak(fakeDb(d), ALICE, "sA"), { ok: true });
  assert.equal(d.saker[0].status, "aktiv");
  assert.equal(d.saker[0].utfall, "medhold");
});

test("gjenåpning av en åpen sak gir feil, ikke stille endring", async () => {
  const d = data();
  const r = await gjenapneSak(fakeDb(d), ALICE, "sA");
  assert.deepEqual(r, { ok: false, feil: "Saken er allerede åpen." });
});

test("feil fra lagre_brev blir forståelige meldinger", () => {
  assert.match(lagreBrevFeilmelding("MEDHOLD_SAK_ENDRET"), /endret i mellomtiden/);
  assert.match(lagreBrevFeilmelding("x MEDHOLD_FANT_IKKE_SAK"), /Fant ikke saken/);
  assert.match(lagreBrevFeilmelding("MEDHOLD_FRIST_ERSTATTET"), /eldre fristene/);
  assert.match(lagreBrevFeilmelding("MEDHOLD_AVSLUTNING_IKKE_BEKREFTET"), /Bekreft at saken/);
  assert.match(lagreBrevFeilmelding("MEDHOLD_UGYLDIG_UTFALL"), /Ukjent utfall/);
  for (const m of [undefined, "noe annet"]) {
    assert.match(lagreBrevFeilmelding(m), /Ingenting ble lagret/);
  }
});

test("fristStatus skiller aktiv, fullført og erstattet", () => {
  assert.equal(fristStatus({ fullfort: false }), "aktiv");
  assert.equal(fristStatus({ fullfort: true, erstattet_at: null }), "fullfort");
  assert.equal(fristStatus({ fullfort: true, erstattet_at: NA }), "erstattet");
});
