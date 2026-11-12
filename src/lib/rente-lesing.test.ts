// Del B: AI-uttrekket av renteFra, renteTil og rentesats. Modellen leses med en
// falsk klient; her testes skjemaet, prompten og normaliseringen.
import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";

import { lesBrevTekst, validerAnalyse } from "./brevanalyse.ts";

const GRUNN = {
  forklaring: "Dette er en betalingsoppfordring.",
  brevtype: "betalingsoppfordring",
  avsender: "Testinkasso AS",
  avsender_epost: "",
  brevdato: "2026-11-02",
  belop: "3058,40",
  hovedstol: "3000",
  saksnummer: "",
  svar_utfall: "uklart",
  foreslatte_steg: [],
  foreslatte_frister: [],
};

const analyse = (kostnadslinjer: unknown[]) => ({ ...GRUNN, kostnadslinjer });

test("gyldige rentefelt beholdes, og sats i norsk format tolkes", () => {
  const a = validerAnalyse(
    analyse([
      { type: "forsinkelsesrente", belop: 58.4, tekst: "Rente", renteFra: "2026-09-01", renteTil: "2026-10-28", rentesats: "12,25" },
    ]),
  )!;
  assert.deepEqual(a.kostnadslinjer, [
    { type: "forsinkelsesrente", belop: 58.4, tekst: "Rente", renteFra: "2026-09-01", renteTil: "2026-10-28", rentesats: 12.25 },
  ]);
});

test("tomme felt, ugyldig dato og sats utenfor 0–40 fjernes uten å forkaste svaret", () => {
  const a = validerAnalyse(
    analyse([
      { type: "forsinkelsesrente", belop: 10, tekst: "", renteFra: "", renteTil: "", rentesats: "" },
      { type: "forsinkelsesrente", belop: 10, tekst: "", renteFra: "2026-02-30", renteTil: "1. oktober", rentesats: "55" },
      { type: "forsinkelsesrente", belop: 10, tekst: "", renteFra: "2026-09-01", renteTil: "2026-10-28", rentesats: "tolv" },
    ]),
  )!;
  assert.deepEqual(a.kostnadslinjer[0], { type: "forsinkelsesrente", belop: 10, tekst: "" });
  assert.deepEqual(a.kostnadslinjer[1], { type: "forsinkelsesrente", belop: 10, tekst: "" });
  assert.deepEqual(a.kostnadslinjer[2], { type: "forsinkelsesrente", belop: 10, tekst: "", renteFra: "2026-09-01", renteTil: "2026-10-28" });
});

test("andre linjetyper mister rentefeltene, og svar uten feltene er fortsatt gyldige", () => {
  const a = validerAnalyse(
    analyse([
      { type: "purregebyr", belop: 38, tekst: "Purring", renteFra: "2026-09-01", renteTil: "2026-10-28", rentesats: "12" },
      { type: "salaer", belop: 600, tekst: "Salær" },
    ]),
  )!;
  assert.deepEqual(a.kostnadslinjer, [
    { type: "purregebyr", belop: 38, tekst: "Purring" },
    { type: "salaer", belop: 600, tekst: "Salær" },
  ]);
});

test("feil type på rentefeltene (tall i stedet for tekst) fjerner feltet, ikke svaret", () => {
  const a = validerAnalyse(
    analyse([{ type: "forsinkelsesrente", belop: 10, tekst: "", renteFra: 20260901, renteTil: null, rentesats: 12.25 }]),
  )!;
  assert.deepEqual(a.kostnadslinjer[0], { type: "forsinkelsesrente", belop: 10, tekst: "" });
});

test("skjemaet ber om de tre feltene, og prompten forbyr gjetting og brevdato som sluttdato", async () => {
  let params: Anthropic.MessageCreateParamsNonStreaming | undefined;
  const klient = {
    messages: {
      create: async (p: Anthropic.MessageCreateParamsNonStreaming) => {
        params = p;
        return {
          content: [{ type: "text", text: JSON.stringify(analyse([])) }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      },
    },
  } as unknown as Anthropic;
  await lesBrevTekst(klient, "Brevtekst");
  const skjema = (params!.output_config as { format: { schema: { properties: { kostnadslinjer: { items: { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean } } } } } }).format.schema;
  const linje = skjema.properties.kostnadslinjer.items;
  for (const felt of ["renteFra", "renteTil", "rentesats"]) {
    assert.ok(felt in linje.properties, felt);
    assert.ok(linje.required.includes(felt), `${felt} er påkrevd i det strenge skjemaet`);
  }
  assert.equal(linje.additionalProperties, false);
  const system = typeof params!.system === "string" ? params!.system : (params!.system ?? []).map((b) => b.text).join("\n");
  assert.match(system, /fyll bare ut renteFra, renteTil og rentesats når brevet oppgir dem for denne rentelinjen/i);
  assert.match(system, /Aldri regn ut, aldri gjett, aldri bruk brevdato som renteTil med mindre brevet sier det/);
});
