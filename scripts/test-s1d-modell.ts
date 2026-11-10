// Manuell måling med syntetiske dokumenter; ingen database eller ekte persondata.
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { lesBrevTekst } from "../src/lib/brevanalyse.ts";
import { brevforklaring } from "../src/lib/brevforklaring.ts";
import { tolkKr } from "../src/lib/format.ts";

const saker = [
  { id: "42", type: "betalingsoppfordring", avsender: "Testinkasso AS", belop: 14221.7,
    tekst: "Testinkasso AS. Betalingsoppfordring datert 6. november 2026. Saksnummer TEST-42. På vegne av Testelektro AS: elektrikerarbeid. Hovedstol 12800 kr, purregebyr 38 kr, inkassovarselgebyr 38 kr, inkassosalær 1200 kr, renter 145,70 kr. Å betale 14221,70 kr innen 20. november 2026." },
  { id: "43", type: "betalingsoppfordring", avsender: "Testinkasso AS", belop: 670.1,
    tekst: "Testinkasso AS. Betalingsoppfordring datert 5. november 2026. Saksnummer TEST-43. Ubetalt abonnement hos Teststrømming AS, en strømmetjeneste for film. Hovedstol 179 kr, purregebyr 38 kr, inkassovarselgebyr 38 kr, salær 300 kr, betalingsoppfordringsgebyr 113 kr, renter 2,10 kr. Å betale 670,10 kr innen 19. november 2026." },
  { id: "44", type: "namsmann", avsender: "Testinkasso AS", belop: 10119.5,
    tekst: "Testinkasso AS. Varsel om tvangsfullbyrdelse datert 7. november 2026. Saksnummer TEST-44. Oppdragsgiver Testkino AS. Forliksrådet har avsagt rettskraftig dom. Vi vil begjære utlegg dersom betaling uteblir. Hovedstol 6500 kr, purregebyr 38 kr, inkassovarselgebyr 38 kr, salær 1200 kr, idømte saksomkostninger 2045 kr, renter 298,50 kr. Å betale 10119,50 kr innen 14. november 2026." },
  { id: "gammelt", type: "inkassovarsel", avsender: "Testbutikk AS", belop: 1100,
    tekst: "Testbutikk AS. Inkassovarsel datert 20. juli 2026. Saksnummer TEST-GAMMELT. Hovedstol 1000 kr, inkassovarselgebyr 100 kr. Å betale 1100 kr innen 27. juli 2026. Dette er hele dokumentet; ingen tidligere varsler eller rettslige hendelser er oppgitt." },
];
const resultater = [];
for (const s of saker) {
  try {
    const r = await lesBrevTekst(new Anthropic(), s.tekst, "8. november 2026");
    if (!r.ok) { resultater.push({ id: s.id, feil: r.feil }); continue; }
    const a = r.data;
    resultater.push({ id: s.id,
      feltStemmer: a.brevtype === s.type && a.avsender === s.avsender && tolkKr(a.belop) === s.belop,
      type: a.brevtype, avsender: a.avsender, belop: a.belop,
      modellforklaringTilManuellKontroll: a.forklaring,
      brukerrettet: brevforklaring({ ...a, belop: tolkKr(a.belop) }),
    });
  } catch { resultater.push({ id: s.id, feil: "modellkjøring_feilet" }); }
}
mkdirSync("docs/testing", { recursive: true });
writeFileSync("docs/testing/s1-d-modellrapport.json", JSON.stringify({ tidspunkt: new Date().toISOString(), resultater }, null, 2));
console.log(JSON.stringify(resultater.map(({ id, ...r }) => ({ id, feltStemmer: "feltStemmer" in r ? r.feltStemmer : false, feil: "feil" in r ? r.feil : null }))));
