// Måling av AI-lesingen mot fasit (MEDHOLD_SIKKERHET_ARBEIDSORDRE §E.3).
// Manuelt, ikke i CI — koster API-kall:
//
//   node --env-file=.env.local scripts/fasit-lesing.ts
//
// Kjører samme analysefunksjon som opplastingen (lesBrevBilder, PDF-en sendes
// som dokument) på hver fasit/brev/testbrev_NN.pdf, sammenligner felt for
// felt med fasit/forventet/NN.json og skriver lesedelen av fasit/rapport.md.
// Et brev som feiler, logges og hoppes over.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { lesBrevBilder, type Analyse } from "../src/lib/brevanalyse.ts";
import { tolkKr } from "../src/lib/format.ts";
import { kontrollerSum } from "../src/lib/sumkontroll.ts";
import { skrivSeksjon, tidsstempel } from "./fasit-rapport.ts";

type Forventet = {
  brev: string;
  verifisert?: boolean;
  brevtype: string;
  brevdato: string | null;
  belop: number | null;
  hovedstol: number | null;
  kostnadslinjer: { type: string; belop: number }[];
  fristIBrevet: string | null;
  saksnummer: string | null;
  avsender: string | null;
};

const FELT = [
  "brevtype",
  "brevdato",
  "belop",
  "hovedstol",
  "kostnadslinjer",
  "fristIBrevet",
  "saksnummer",
  "avsender",
] as const;
type Felt = (typeof FELT)[number];

type Lest = Record<Felt, unknown>;

/** AI-resultatet i samme form som fasit — samme tolkning som appen gjør. */
function somFasit(a: Analyse): Lest {
  return {
    brevtype: a.brevtype,
    brevdato: a.brevdato || null,
    belop: tolkKr(a.belop),
    hovedstol: tolkKr(a.hovedstol),
    kostnadslinjer: a.kostnadslinjer.map((l) => ({ type: l.type, belop: l.belop })),
    // Samme valg som LeggTilBrevFlyt: første eksplisitte frist med dato.
    fristIBrevet: a.foreslatte_frister.find((f) => f.forfallsdato)?.forfallsdato ?? null,
    saksnummer: a.saksnummer || null,
    avsender: a.avsender || null,
  };
}

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function linjeNokler(l: unknown): string[] {
  return ((l as { type: string; belop: number }[]) ?? [])
    .map((x) => `${x.type}:${x.belop}`)
    .sort();
}

/** Beløp og datoer eksakt; kostnadslinjer som samme mengde; tekst normalisert. */
function likt(felt: Felt, forventet: unknown, fikk: unknown): boolean {
  switch (felt) {
    case "belop":
    case "hovedstol":
      return forventet === null
        ? fikk === null
        : typeof fikk === "number" && Math.abs(fikk - (forventet as number)) < 0.005;
    case "kostnadslinjer":
      return JSON.stringify(linjeNokler(forventet)) === JSON.stringify(linjeNokler(fikk));
    case "avsender": {
      // Avsender kan stå med og uten «AS»/kreditor i parentes — godta at den
      // ene inneholder den andre, men aldri tomt mot noe.
      const e = norm(forventet);
      const f = norm(fikk);
      if (!e || !f) return e === f;
      return e.includes(f) || f.includes(e);
    }
    case "saksnummer":
      return norm(forventet).replace(/\s/g, "") === norm(fikk).replace(/\s/g, "");
    default:
      return (forventet ?? null) === (fikk ?? null);
  }
}

function vis(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? linjeNokler(v).join(", ") : "ingen";
  return String(v);
}

async function main() {
  const mappe = new URL("../fasit/forventet/", import.meta.url);
  const brevMappe = new URL("../fasit/brev/", import.meta.url);
  const filer = readdirSync(mappe).filter((f) => f.endsWith(".json")).sort();
  const anthropic = new Anthropic();

  const treff: Record<Felt, { riktig: number; totalt: number }> = Object.fromEntries(
    FELT.map((f) => [f, { riktig: 0, totalt: 0 }]),
  ) as Record<Felt, { riktig: number; totalt: number }>;
  const bom: { brev: string; felt: Felt; forventet: string; fikk: string }[] = [];
  const feilet: { brev: string; grunn: string }[] = [];
  let lest = 0;
  let medBelopsbom = 0;
  let fangetAvSum = 0;

  for (const fil of filer) {
    const f = JSON.parse(readFileSync(new URL(fil, mappe), "utf8")) as Forventet;
    const pdf = new URL(f.brev, brevMappe);
    if (!existsSync(pdf)) {
      console.error(`[fasit-lesing] ${f.brev}: PDF mangler i fasit/brev/ — hopper over.`);
      feilet.push({ brev: f.brev, grunn: "PDF mangler i fasit/brev/" });
      continue;
    }
    const data = readFileSync(pdf).toString("base64");
    const r = await lesBrevBilder(anthropic, [{ media_type: "application/pdf", data }]);
    if (!r.ok) {
      // Feiltypen (avbrutt, ugyldig_struktur, tidsavbrudd …) skiller lesefeil
      // fra regelfeil i rapporten.
      feilet.push({ brev: f.brev, grunn: `lesingen feilet: ${r.feil}` });
      continue;
    }
    const analyse: Analyse = r.data;
    lest++;
    const fikk = somFasit(analyse);
    let belopsbom = false;
    for (const felt of FELT) {
      treff[felt].totalt++;
      if (likt(felt, f[felt], fikk[felt])) {
        treff[felt].riktig++;
      } else {
        bom.push({ brev: f.brev, felt, forventet: vis(f[felt]), fikk: vis(fikk[felt]) });
        if (felt === "belop" || felt === "hovedstol" || felt === "kostnadslinjer")
          belopsbom = true;
      }
    }
    // Ville sumkontrollen (§A.1) ha fanget feilen? Den ser bare AI-ens egne
    // tall — et avvik der betyr at bekreftelseskortet hadde sagt ifra.
    if (belopsbom) {
      medBelopsbom++;
      const s = kontrollerSum(
        fikk.belop as number | null,
        fikk.hovedstol as number | null,
        fikk.kostnadslinjer as { belop: number }[],
      );
      if (s.status === "avvik") fangetAvSum++;
    }
    console.log(`[fasit-lesing] ${f.brev}: ferdig`);
  }

  const linjer: string[] = [];
  linjer.push("## Lesing av brev (§E.3)", "");
  linjer.push(`Sist kjørt: ${tidsstempel()}. Forventet-filer: ${filer.length}. Lest: ${lest}.`, "");
  if (lest > 0) {
    linjer.push("| Felt | Treff | Andel |", "|---|---|---|");
    for (const felt of FELT) {
      const t = treff[felt];
      linjer.push(`| ${felt} | ${t.riktig}/${t.totalt} | ${Math.round((100 * t.riktig) / t.totalt)} % |`);
    }
    linjer.push("");
    linjer.push(
      `Sumkontrollen ville fanget ${fangetAvSum} av ${medBelopsbom} brev med feil i beløp, hovedstol eller kostnadslinjer.`,
      "",
    );
    linjer.push("### Bom", "");
    if (bom.length === 0) linjer.push("Ingen.");
    else {
      linjer.push("| Brev | Felt | Forventet | Fikk |", "|---|---|---|---|");
      for (const b of bom) linjer.push(`| ${b.brev} | ${b.felt} | ${b.forventet} | ${b.fikk} |`);
    }
    linjer.push("");
  }
  if (feilet.length > 0) {
    linjer.push("### Ikke lest", "");
    for (const x of feilet) linjer.push(`- ${x.brev}: ${x.grunn}`);
    linjer.push("");
  }
  skrivSeksjon("lesing", linjer.join("\n"));
  console.log(`[fasit-lesing] Rapport skrevet: ${lest} lest, ${feilet.length} ikke lest.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
