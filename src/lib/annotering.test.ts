import { test } from "node:test";
import assert from "node:assert/strict";

import { finnAnnoteringer } from "./annotering.ts";
import { sjekkKostnader, type Kostnadslinje } from "./gebyr.ts";

test("ingen treff gir tom liste", () => {
  const res = finnAnnoteringer("En helt vanlig brevtekst uten tall.", [], null, null, null, []);
  assert.deepEqual(res, []);
});

test("kostnadslinje funnet ordrett gir type 'kostnad' når innenfor sats", () => {
  const linjer: Kostnadslinje[] = [
    { type: "purregebyr", belop: 38, tekst: "Purregebyr: 38 kr" },
  ];
  const gebyrsjekk = sjekkKostnader(linjer, null, "2026-06-01");
  const tekst = "Vi viser til tidligere brev. Purregebyr: 38 kr er lagt til.";
  const res = finnAnnoteringer(tekst, linjer, gebyrsjekk, null, null, []);
  assert.equal(res.length, 1);
  assert.equal(res[0].type, "kostnad");
  assert.equal(res[0].start, tekst.indexOf("Purregebyr: 38 kr"));
  assert.equal(res[0].slutt, res[0].start + "Purregebyr: 38 kr".length);
});

test("kostnadslinje over sats gir type 'funn' og gjenbruker forklaringen", () => {
  const linjer: Kostnadslinje[] = [
    { type: "purregebyr", belop: 70, tekst: "Purregebyr 70 kr" },
  ];
  const gebyrsjekk = sjekkKostnader(linjer, null, "2026-06-01");
  const tekst = "Purregebyr 70 kr påløper ved forsinket betaling.";
  const res = finnAnnoteringer(tekst, linjer, gebyrsjekk, null, null, []);
  assert.equal(res.length, 1);
  assert.equal(res[0].type, "funn");
  assert.equal(res[0].etikett, gebyrsjekk.linjer[0].forklaring);
});

test("kostnadslinje som ikke finnes ordrett i teksten hoppes over", () => {
  const linjer: Kostnadslinje[] = [
    { type: "salaer", belop: 800, tekst: "Salær kr 800,-" },
  ];
  const gebyrsjekk = sjekkKostnader(linjer, 2400, "2026-06-01");
  // Teksten har IKKE strengen "Salær kr 800,-" ordrett (annen formatering).
  const tekst = "Inkassosalæret utgjør åtte hundre kroner.";
  const res = finnAnnoteringer(tekst, linjer, gebyrsjekk, null, null, []);
  assert.deepEqual(res, []);
});

test("hovedstol og totalbeløp finnes som rene sifre", () => {
  const tekst = "Hovedstolen er 2400 kr. Totalt skylder du 3201 kr innen fristen.";
  const res = finnAnnoteringer(tekst, [], null, 2400, 3201, []);
  assert.equal(res.length, 2);
  assert.ok(res.some((a) => a.type === "belop" && a.etikett.includes("Hovedstol")));
  assert.ok(res.some((a) => a.type === "belop" && a.etikett.includes("Totalt")));
});

test("frist-dato finnes i lang norsk form", () => {
  const tekst = "Fristen for å betale er 24. juli 2026, ellers går saken videre.";
  const res = finnAnnoteringer(tekst, [], null, null, null, [
    { tittel: "Betalingsfrist", forfallsdato: "2026-07-24" },
  ]);
  assert.equal(res.length, 1);
  assert.equal(res[0].type, "dato");
  assert.equal(res[0].etikett, "Betalingsfrist");
});

test("frist-dato som ikke står i teksten gir ingen annotering", () => {
  const tekst = "Ingen dato nevnt her i det hele tatt.";
  const res = finnAnnoteringer(tekst, [], null, null, null, [
    { tittel: "Betalingsfrist", forfallsdato: "2026-07-24" },
  ]);
  assert.deepEqual(res, []);
});

test("første treff per verdi — samme tekst to steder gir kun én annotering", () => {
  const linjer: Kostnadslinje[] = [
    { type: "purregebyr", belop: 38, tekst: "38 kr" },
  ];
  const tekst = "Gebyret er 38 kr. Vi minner om at 38 kr forfaller snart.";
  const res = finnAnnoteringer(tekst, linjer, null, null, null, []);
  assert.equal(res.length, 1);
  assert.equal(res[0].start, tekst.indexOf("38 kr"));
});

test("overlappende annoteringer beholder laveste start, resten forkastes", () => {
  // Kostnadslinjen «Salær 800 kr» starter på indeks 0. Beløpet 800 (hovedstol)
  // finnes INNI den samme teksten («800» starter på indeks 6) — de overlapper,
  // og kostnadslinjen (lavest start) skal vinne over hovedstol-treffet.
  const linjer: Kostnadslinje[] = [
    { type: "salaer", belop: 800, tekst: "Salær 800 kr" },
  ];
  const tekst = "Salær 800 kr er inkludert i kravet.";
  const res = finnAnnoteringer(tekst, linjer, null, 800, null, []);
  assert.equal(res.length, 1);
  assert.equal(res[0].type, "kostnad");
  assert.equal(res[0].start, 0);
});

test("resultatet er sortert stigende på start", () => {
  const tekst = "Beløpet 500 kr forfaller 10. juli 2026, hovedstol 100 kr.";
  const res = finnAnnoteringer(tekst, [], null, 100, 500, [
    { tittel: "Frist", forfallsdato: "2026-07-10" },
  ]);
  assert.equal(res.length, 3);
  for (let i = 1; i < res.length; i++) {
    assert.ok(res[i].start >= res[i - 1].start);
  }
});
