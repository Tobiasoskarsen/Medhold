// Del B.4: innsigelsen når brevet krever mer enn hovedstol og kostnader blir.
import { test } from "node:test";
import assert from "node:assert/strict";

import { bestridtBelop, byggPrompt, gjeldendeOmfang, ubestridtDel } from "./utkast-prompt.ts";
import { byggVaktFakta, kontrollerUtkast } from "./utkast-vakt.ts";
import { sjekkKostnader, type GebyrsjekkResultat } from "./gebyr.ts";

const N = " ";

// Testbrev 38: krav 4 912,30, hovedstol 4 512,30 og 300 kr i kostnader.
const SUM = { status: "avvik", sum: 4812.3, total: 4912.3, differanse: 100, bekreftetLikevel: true };
const bareSum = { satsGyldigFra: "2026-01-01", linjer: [], antallOver: 0, antallMuligOver: 0, sumkontroll: SUM } as unknown as GebyrsjekkResultat;
const utenSum = { satsGyldigFra: "2026-01-01", linjer: [], antallOver: 0, antallMuligOver: 0 } as GebyrsjekkResultat;

const grunnlag = (gebyrsjekk: GebyrsjekkResultat | null, omfang: "delvis" | "helt" | null = "delvis") => ({
  type: "innsigelse" as const,
  originalTekst: "Betalingsoppfordring fra Nordkapp Inkasso AS. Å betale 4 912,30 kr.",
  gebyrsjekk,
  stadium: "betalingsoppfordring",
  belopTotalt: 4912.3,
  detaljer: "",
  navn: "",
  avdrag: null,
  omfang,
});

test("sumavvik gjør delvis innsigelse mulig, og den ubestridte delen er total minus differansen", () => {
  assert.equal(gjeldendeOmfang("innsigelse", bareSum, null), "delvis");
  assert.equal(gjeldendeOmfang("innsigelse", bareSum, "helt"), "helt");
  assert.equal(gjeldendeOmfang("innsigelse", utenSum, "delvis"), "helt");
  assert.equal(gjeldendeOmfang("nedbetalingsavtale", bareSum, "delvis"), null);
  assert.equal(bestridtBelop(bareSum), 100);
  assert.equal(ubestridtDel(4912.3, bareSum), 4812.3);
});

test("testbrev 38: prompten ber om spesifikasjon av 100 kr og nevner at 4 812,30 kr betales", () => {
  const { system, meldinger } = byggPrompt(grunnlag(bareSum));
  const bruker = meldinger.at(-1)!.content;
  assert.match(system, new RegExp(`Be om en spesifikasjon av differansen på 100 kr\\. Skriv at denne delen er omtvistet til den er forklart\\. Skriv ALDRI at kreditor har regnet feil med vilje\\.`));
  assert.match(system, /Brevet bestrider KUN 100 kr, beløpet i kravet som ikke går opp\./);
  assert.ok(system.includes(`betaler den ubestridte delen på 4${N}812,30 kr`));
  assert.ok(bruker.includes(`Fakta fra Medhold: Brevet krever 4${N}912,30 kr, men hovedstol og kostnader blir 4${N}812,30 kr. Differansen er 100 kr.`));
});

test("sumavvik og gebyrfunn: begge bestrides, og den ubestridte delen trekker fra begge", () => {
  const gebyr = sjekkKostnader([{ type: "salaer", belop: 900, tekst: "Salær" }], 2400, "2026-11-02");
  const begge = { ...gebyr, sumkontroll: SUM } as unknown as GebyrsjekkResultat;
  assert.equal(bestridtBelop(begge), 250);
  assert.equal(ubestridtDel(4912.3, begge), 4662.3);
  const { system } = byggPrompt(grunnlag(begge));
  assert.match(system, /Brevet bestrider KUN 250 kr, beløpet over maksimalsatsen og beløpet i kravet som ikke går opp\./);
  assert.match(system, /spesifikasjon av differansen på 100 kr/);
});

test("uten sumavvik er prompten som før, og hele kravet nevner ikke differansen", () => {
  const gebyr = sjekkKostnader([{ type: "salaer", belop: 900, tekst: "Salær" }], 2400, "2026-11-02");
  const { system, meldinger } = byggPrompt(grunnlag(gebyr));
  assert.match(system, /Brevet bestrider KUN 150 kr, beløpet over maksimalsatsen\. /);
  assert.doesNotMatch(system + meldinger.at(-1)!.content, /spesifikasjon|Differansen er/);
  const helt = byggPrompt(grunnlag(bareSum, "helt"));
  assert.doesNotMatch(helt.system + helt.meldinger.at(-1)!.content, /spesifikasjon|Differansen er/);
});

test("vakten godtar summen, differansen og den nye ubestridte delen", () => {
  const fakta = byggVaktFakta({
    originalTekst: grunnlag(bareSum).originalTekst,
    belopTotalt: 4912.3,
    belopHovedstol: 4512.3,
    kostnadslinjer: [{ belop: 300 }],
    gebyrsjekk: bareSum,
    ubestridt: ubestridtDel(4912.3, bareSum),
    avdrag: null,
    detaljer: "",
    brevdato: "2026-11-02",
    fristdato: null,
    idag: "2026-11-11",
    omfang: "delvis",
  });
  for (const b of [4812.3, 100, 4912.3]) assert.ok(fakta.tillatteBelop.includes(b), String(b));
  const funn = kontrollerUtkast(
    "Hei,\n\nBrevet krever 4 912,30 kr, men hovedstol og kostnader blir 4 812,30 kr. Jeg ber om en spesifikasjon av differansen på 100 kr. Denne delen er omtvistet til den er forklart. Jeg betaler den ubestridte delen på 4 812,30 kr.\n\nVennlig hilsen",
    fakta,
  );
  assert.deepEqual(funn.filter((f) => f.type === "belop"), []);
});
