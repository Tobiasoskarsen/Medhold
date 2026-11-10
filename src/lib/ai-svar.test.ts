import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";

import {
  datoEllerTom,
  erIsoDato,
  erOperasjonellFeil,
  klassifiserAiFeil,
  lesStrukturert,
  vurderStopp,
} from "./ai-svar.ts";
import { lesBrevBilder, lesBrevTekst, validerAnalyse } from "./brevanalyse.ts";

// --- Et gyldig analysesvar, slik modellen skal levere det ---------------------

const GYLDIG = {
  forklaring: "Dette er en betalingsoppfordring.",
  brevtype: "betalingsoppfordring",
  avsender: "Inkasso AS",
  avsender_epost: "",
  brevdato: "2026-11-05",
  belop: "670,10",
  hovedstol: "179",
  saksnummer: "GT-1",
  svar_utfall: "uklart",
  foreslatte_steg: ["Finn kvitteringen"],
  foreslatte_frister: [{ tittel: "Betalingsfrist", forfallsdato: "2026-11-19" }],
  kostnadslinjer: [{ type: "salaer", belop: 300, tekst: "Inkassosalær" }],
};

function melding(tekst: string, stopp: string | null = "end_turn") {
  return {
    content: [{ type: "text", text: tekst }],
    stop_reason: stopp,
    usage: { input_tokens: 1200, output_tokens: 340 },
  } as unknown as Anthropic.Message;
}

/** Falsk klient: returnerer et gitt svar, eller kaster en gitt feil. */
function klient(svar: Anthropic.Message | Error) {
  return {
    messages: {
      create: async () => {
        if (svar instanceof Error) throw svar;
        return svar;
      },
    },
  } as unknown as Anthropic;
}

// --- vurderStopp og feilklassifisering -----------------------------------------

test("bare normal avslutning regnes som komplett", () => {
  assert.equal(vurderStopp("end_turn"), null);
  assert.equal(vurderStopp("stop_sequence"), null);
  for (const s of ["max_tokens", "refusal", "pause_turn", "model_context_window_exceeded", null, undefined]) {
    assert.equal(vurderStopp(s as string | null), "avbrutt", String(s));
  }
});

test("SDK-feil klassifiseres: tidsavbrudd, nettverk, tjeneste, ukjent", () => {
  assert.equal(klassifiserAiFeil(new Anthropic.APIConnectionTimeoutError()), "tidsavbrudd");
  assert.equal(klassifiserAiFeil(new Anthropic.APIConnectionError({ message: "x" })), "nettverk");
  const status = (s: number) => new Anthropic.APIError(s, undefined, "x", undefined);
  assert.equal(klassifiserAiFeil(status(429)), "tjeneste");
  assert.equal(klassifiserAiFeil(status(529)), "tjeneste");
  assert.equal(klassifiserAiFeil(status(500)), "tjeneste");
  assert.equal(klassifiserAiFeil(status(408)), "tidsavbrudd");
  assert.equal(klassifiserAiFeil(status(400)), "ukjent");
  assert.equal(klassifiserAiFeil(new Error("noe")), "ukjent");
});

test("operasjonelle feil skilles fra feil i selve svaret", () => {
  for (const f of ["tidsavbrudd", "nettverk", "tjeneste", "ukjent"] as const) assert.equal(erOperasjonellFeil(f), true);
  for (const f of ["avbrutt", "ugyldig_struktur"] as const) assert.equal(erOperasjonellFeil(f), false);
});

// --- Strukturerte svar ------------------------------------------------------------

test("T11: avkuttet svar (max_tokens) gir «avbrutt», selv med gyldig JSON", () => {
  const r = lesStrukturert(melding(JSON.stringify(GYLDIG), "max_tokens"), validerAnalyse);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.feil, "avbrutt");
  assert.equal(r.bruk?.ut, 340, "målinger følger med, uten tekst");
});

test("T11: avkuttet JSON gir «ugyldig_struktur» når stop_reason likevel er normal", () => {
  const avkuttet = JSON.stringify(GYLDIG).slice(0, 80);
  const r = lesStrukturert(melding(avkuttet), validerAnalyse);
  assert.equal(!r.ok && r.feil, "ugyldig_struktur");
});

test("svar uten tekstblokk er ugyldig", () => {
  const svar = { content: [], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 0 } } as unknown as Anthropic.Message;
  assert.equal(lesStrukturert(svar, validerAnalyse).ok, false);
});

test("gyldig svar valideres og ekstra felt følger ikke med", () => {
  const r = lesStrukturert(melding(JSON.stringify({ ...GYLDIG, ekstra: "skal bort" })), validerAnalyse);
  assert.equal(r.ok, true);
  assert.ok(r.ok && !("ekstra" in r.data));
});

test("manglende felt, feil type eller ukjent verdi gjør svaret ugyldig", () => {
  const varianter: Record<string, unknown>[] = [
    { ...GYLDIG, forklaring: undefined },
    { ...GYLDIG, forklaring: "   " },
    { ...GYLDIG, belop: 670.1 },
    { ...GYLDIG, brevtype: "trusselbrev" },
    { ...GYLDIG, svar_utfall: "seier" },
    { ...GYLDIG, foreslatte_steg: "ett steg" },
    { ...GYLDIG, foreslatte_frister: [{ tittel: 3, forfallsdato: "" }] },
    { ...GYLDIG, kostnadslinjer: [{ type: "salaer", belop: "300", tekst: "x" }] },
    { ...GYLDIG, kostnadslinjer: [{ type: "salaer", belop: -5, tekst: "x" }] },
    { ...GYLDIG, kostnadslinjer: [{ type: "bot", belop: 5, tekst: "x" }] },
  ];
  for (const v of varianter) assert.equal(validerAnalyse(v), null, JSON.stringify(v).slice(0, 80));
  assert.equal(validerAnalyse(null), null);
  assert.equal(validerAnalyse([GYLDIG]), null);
});

test("ugyldige kalenderdatoer blir ukjent, ikke gjettet", () => {
  assert.equal(erIsoDato("2026-02-30"), false);
  assert.equal(erIsoDato("2026-11-05"), true);
  assert.equal(datoEllerTom("05.11.2026"), "");
  assert.equal(datoEllerTom(""), "");
  assert.equal(datoEllerTom(5), null);
  const a = validerAnalyse({ ...GYLDIG, brevdato: "2026-02-30" });
  assert.equal(a?.brevdato, "");
});

// --- Hele lesefunksjonen, med falsk klient ------------------------------------------

test("lesBrevTekst: komplett svar gir analysen", async () => {
  const r = await lesBrevTekst(klient(melding(JSON.stringify(GYLDIG))), "Brevtekst", "5. november 2026");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.data.belop, "670,10");
});

test("T11: lesBrevTekst gir aldri en analyse fra et avkuttet svar", async () => {
  const r = await lesBrevTekst(klient(melding(JSON.stringify(GYLDIG), "max_tokens")), "Brevtekst", "x");
  assert.deepEqual([r.ok, !r.ok && r.feil], [false, "avbrutt"]);
});

test("lesBrevTekst kaster aldri, men klassifiserer nettverk og tidsavbrudd", async () => {
  const t = await lesBrevTekst(klient(new Anthropic.APIConnectionTimeoutError()), "x", "x");
  assert.equal(!t.ok && t.feil, "tidsavbrudd");
  const n = await lesBrevTekst(klient(new Anthropic.APIConnectionError({ message: "x" })), "x", "x");
  assert.equal(!n.ok && n.feil, "nettverk");
});

test("lesBrevBilder krever en ikke-tom transkripsjon", async () => {
  const uten = await lesBrevBilder(klient(melding(JSON.stringify({ ...GYLDIG, ekstrahert_tekst: "" }))), [], "x");
  assert.equal(!uten.ok && uten.feil, "ugyldig_struktur");
  const med = await lesBrevBilder(klient(melding(JSON.stringify({ ...GYLDIG, ekstrahert_tekst: "Hei" }))), [], "x");
  assert.equal(med.ok && med.data.ekstrahert_tekst, "Hei");
});
