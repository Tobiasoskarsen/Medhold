// Måling av AI-lesingen av renteFra, renteTil og rentesats (Del B).
// Manuelt, ikke i CI — koster API-kall:
//
//   node --env-file=.env.local scripts/fasit-rente.ts [kjøringer per brev, standard 20]
//
// Leser hvert fasit/brev/rente_N.txt flere ganger med samme funksjon som
// opplastingen, sammenligner rentefeltene med fasit/forventet/rente-N.json og
// skriver rente-delen av fasit/rapport.md. Syntetiske brev, ingen persondata.
import { readFileSync, readdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { lesBrevTekst } from "../src/lib/brevanalyse.ts";
import { sjekkKostnader, RENTE_KAN_VAERE_OVER, type Kostnadstype } from "../src/lib/gebyr.ts";
import { skrivSeksjon, tidsstempel } from "./fasit-rapport.ts";

type Linje = { type: Kostnadstype; belop: number; renteFra?: string; renteTil?: string; rentesats?: number };
type Forventet = {
  brev: string;
  brevtype: string;
  hovedstol: number | null;
  brevdato: string;
  kostnadslinjer: Linje[];
  forventetGebyrsjekk: string[];
};

const ANTALL = Number(process.argv[2]) || 20;

async function main() {
  const mappe = new URL("../fasit/forventet/", import.meta.url);
  const brevMappe = new URL("../fasit/brev/", import.meta.url);
  const filer = readdirSync(mappe).filter((f) => /^rente-\d+\.json$/.test(f)).sort();
  const anthropic = new Anthropic();
  const rader: string[] = [];
  let feilRunder = 0;
  let runder = 0;
  let vurderingFeil = 0;
  let lesefeil = 0;

  for (const fil of filer) {
    const f = JSON.parse(readFileSync(new URL(fil, mappe), "utf8")) as Forventet;
    const tekst = readFileSync(new URL(f.brev.replace(/\.json$/, ""), brevMappe), "utf8");
    const rente = f.kostnadslinjer.find((l) => l.type === "forsinkelsesrente");
    if (!rente) continue;
    let fraFeil = 0;
    let tilFeil = 0;
    let satsFeil = 0;
    let belopFeil = 0;
    let typeFeil = 0;
    let brevFeil = 0;
    let ok = 0;
    for (let i = 0; i < ANTALL; i++) {
      const r = await lesBrevTekst(anthropic, tekst, "2. november 2026");
      if (!r.ok) {
        lesefeil++;
        continue;
      }
      ok++;
      runder++;
      const l = r.data.kostnadslinjer.find((x) => x.type === "forsinkelsesrente");
      const fra = (l?.renteFra ?? null) === (rente.renteFra ?? null);
      const til = (l?.renteTil ?? null) === (rente.renteTil ?? null);
      const sats = (l?.rentesats ?? null) === (rente.rentesats ?? null);
      const belop = !!l && Math.abs(l.belop - rente.belop) < 0.005;
      if (!fra) fraFeil++;
      if (!til) tilFeil++;
      if (!sats) satsFeil++;
      if (!belop) belopFeil++;
      if (!l) typeFeil++;
      if (!(fra && til && sats && belop && l)) {
        brevFeil++;
        feilRunder++;
      }
      if (l) {
        const v = sjekkKostnader(
          r.data.kostnadslinjer.map((x) => ({ ...x })),
          f.hovedstol ?? 0,
          f.brevdato,
          f.brevtype,
          f.hovedstol !== null,
        ).linjer.map((x) => x.vurdering);
        const forv = f.forventetGebyrsjekk.map((x) => (x === "over" && !RENTE_KAN_VAERE_OVER ? "mulig_over" : x));
        if (JSON.stringify(v) !== JSON.stringify(forv)) vurderingFeil++;
      }
    }
    rader.push(`| ${f.brev} | ${ok} | ${fraFeil} | ${tilFeil} | ${satsFeil} | ${belopFeil} | ${typeFeil} | ${brevFeil} |`);
    console.log(`[fasit-rente] ${f.brev}: ferdig (${ok} lest)`);
  }

  const per20 = runder ? (20 * feilRunder) / runder : 0;
  const linjer = [
    "## Lesing av renteperiode og sats (Del B)",
    "",
    `Sist kjørt: ${tidsstempel()}. ${filer.length} syntetiske brev × ${ANTALL} kjøringer. Lest: ${runder}. Lesefeil (kall feilet): ${lesefeil}.`,
    "",
    "| Brev | Lest | renteFra feil | renteTil feil | rentesats feil | beløp feil | linje mangler | Kjøringer med minst én feil |",
    "|---|---|---|---|---|---|---|---|",
    ...rader,
    "",
    `Kjøringer med minst ett feil rentefelt, beløp eller manglende linje: ${feilRunder} av ${runder} (ca. ${per20.toFixed(1)} per 20).`,
    `Kjøringer der appens vurdering avvek fra fasit: ${vurderingFeil}.`,
    "",
    `Grense (arbeidsordre): «over» på renter kan først slås på når lesingen er feil i høyst 1 av 20. Status: ${runder > 0 && per20 <= 1 ? "innenfor grensen" : "utenfor grensen eller ikke målt"}. RENTE_KAN_VAERE_OVER = ${RENTE_KAN_VAERE_OVER}.`,
  ];
  skrivSeksjon("rente", linjer.join("\n"));
  console.log(`[fasit-rente] ${feilRunder}/${runder} kjøringer med feil (${per20.toFixed(1)} per 20).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
