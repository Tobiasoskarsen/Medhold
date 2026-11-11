import { test } from "node:test";
import assert from "node:assert/strict";

import { gebyrsjekkSetning, sumavvikLinje, sumavvikTekst, sumOverTotalTekst, ukjentPille, VURDERING_PILL } from "./gebyrfunn-visning.ts";
import { sjekkKostnader, UKJENT_ARSAK, type Kostnadstype, type LinjeResultat, type Vurdering } from "./gebyr.ts";

const N = " ";
const linje = (vurdering: Vurdering, type: Kostnadstype, differanse: number | null = null): LinjeResultat => ({
  linje: { type, belop: 100, tekst: "" },
  vurdering,
  maksLav: null,
  maksHoy: null,
  differanse,
  forklaring: "",
});

test("testbrev 37: salær over sats og rente som ikke sjekkes", () => {
  // Hovedstol 2 400 gir maks salær 750; brevet krever 900.
  const r = sjekkKostnader(
    [
      { type: "salaer", belop: 900, tekst: "Inkassosalær" },
      { type: "forsinkelsesrente", belop: 18.9, tekst: "Renter" },
    ],
    2400,
    "2026-11-02",
  );
  assert.equal(gebyrsjekkSetning(r.linjer), "Ett gebyr er høyere enn loven tillater. Renter sjekker vi ikke ennå.");
  const over = r.linjer.find((l) => l.vurdering === "over")!;
  assert.equal(VURDERING_PILL.over.tekst(over), "150 kr for mye");
});

test("første regel som treffer: over, mulig over, innenfor, ingenting", () => {
  assert.equal(gebyrsjekkSetning([linje("over", "salaer", 10), linje("over", "purregebyr", 5)]), "2 gebyrer er høyere enn loven tillater.");
  assert.equal(
    gebyrsjekkSetning([linje("mulig_over", "salaer"), linje("innenfor", "purregebyr")]),
    "Ingen gebyrer er over grensen for alle saker, men ett kan være for høyt.",
  );
  assert.equal(
    gebyrsjekkSetning([linje("mulig_over", "salaer"), linje("mulig_over", "salaer")]),
    "Ingen gebyrer er over grensen for alle saker, men 2 kan være for høye.",
  );
  assert.equal(gebyrsjekkSetning([linje("innenfor", "purregebyr")]), "Gebyrene vi kunne sjekke, er innenfor det loven tillater.");
  assert.equal(
    gebyrsjekkSetning([linje("ukjent", "rettsgebyr")]),
    "Vi kunne ikke sjekke noen av kostnadene i dette brevet. Rettsgebyr sjekker vi ikke ennå.",
  );
});

test("flere ting vi ikke sjekker slås sammen med «og», uten gjentakelse", () => {
  assert.equal(
    gebyrsjekkSetning([
      linje("innenfor", "purregebyr"),
      linje("ukjent", "forsinkelsesrente"),
      linje("ukjent", "forsinkelsesrente"),
      linje("ukjent", "rettsgebyr"),
      linje("ukjent", "annet"),
    ]),
    "Gebyrene vi kunne sjekke, er innenfor det loven tillater. Renter og rettsgebyr og andre kostnader sjekker vi ikke ennå.",
  );
});

test("pillene har samme etiketter overalt, og ordet «merknad» brukes ikke", () => {
  assert.equal(VURDERING_PILL.innenfor.tekst(linje("innenfor", "purregebyr")), "Innenfor");
  assert.equal(VURDERING_PILL.mulig_over.tekst(linje("mulig_over", "salaer")), "Kan være for høyt");
  assert.equal(VURDERING_PILL.ukjent.tekst(linje("ukjent", "rettsgebyr")), "Ikke sjekket");
  assert.equal(VURDERING_PILL.over.tekst(linje("over", "salaer", 1250.5)), `1${N}250,50 kr for mye`);
  assert.match(VURDERING_PILL.over.klasse, /dom-rod/);
  assert.doesNotMatch(VURDERING_PILL.ukjent.klasse + VURDERING_PILL.mulig_over.klasse, /dom-rod/);
});

test("testbrev 38: sumkortet og Hjem-linjen, ordrett", () => {
  const s = { sum: 4812.3, total: 4912.3, differanse: 100 };
  assert.deepEqual(sumavvikTekst(s), {
    etikett: "Beløpskontroll",
    tall: "100 kr uten forklaring",
    tekst: `Brevet krever 4${N}912,30 kr, men hovedstol og kostnader blir 4${N}812,30 kr. Be kreditor forklare differansen før du betaler den.`,
  });
  assert.equal(sumavvikLinje(s), "Beløpskontroll: 100 kr uten forklaring");
  assert.equal(
    sumOverTotalTekst(1288, 289),
    `Hovedstol og kostnader blir 1${N}288 kr, mer enn de 289 kr brevet krever. Betal aldri mer enn brevet krever.`,
  );
});

test("ukjent-pillen viser årsaken når den er kjent, ellers «Ikke sjekket»", () => {
  assert.equal(ukjentPille(UKJENT_ARSAK.manglerStadium), "Mangler stadium");
  assert.equal(ukjentPille(UKJENT_ARSAK.stadiumUklart), "Stadium uklart");
  assert.equal(ukjentPille(UKJENT_ARSAK.ikkeKjentSats), "Samsvarer ikke med kjent sats");
  assert.equal(ukjentPille("Kontroll av renter kommer senere."), "Ikke sjekket");
  assert.equal(ukjentPille(""), "Ikke sjekket");
  const gs = sjekkKostnader([{ type: "rettsgebyr", belop: 2500, tekst: "" }], null, "2026-06-01", "forliksrad");
  assert.equal(VURDERING_PILL.ukjent.tekst(gs.linjer[0]), "Samsvarer ikke med kjent sats");
});
