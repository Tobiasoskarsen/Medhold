// Utkast-fasit (MEDHOLD_SIKKERHET_ARBEIDSORDRE §E.4). Manuelt, ikke i CI —
// koster API-kall:
//
//   node --env-file=.env.local scripts/fasit-utkast.ts
//
// Genererer ett utkast per scenario i fasit/utkast/scenarioer.json med den
// ekte prompten (byggPrompt), den ekte etterkontrollen og vaktene
// (genererUtkast), og skriver utkastdelen av fasit/rapport.md: andel uten
// advarsler etter regenerering, alle advarsler og ordtall. Bom rettes i
// prompten, ikke i vaktene.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { sjekkKostnader, type Kostnadslinje } from "../src/lib/gebyr.ts";
import { beregnAvdrag } from "../src/lib/avdrag.ts";
import { tellOrd } from "../src/lib/format.ts";
import { byggVaktFakta } from "../src/lib/utkast-vakt.ts";
import {
  byggPrompt,
  genererUtkast,
  gjeldendeOmfang,
  ubestridtDel,
  type Omfang,
} from "../src/lib/utkast-prompt.ts";
import type { UtkastType } from "../src/lib/types.ts";
import { skrivSeksjon, tidsstempel } from "./fasit-rapport.ts";

type Scenario = {
  id: string;
  kategori: string;
  type: UtkastType;
  omfang: Omfang | null;
  stadium: string;
  navn: string;
  detaljer: string;
  manedsbelop?: number;
  brev: {
    tekst: string;
    brevdato: string;
    fristdato: string | null;
    belopTotalt: number;
    hovedstol: number | null;
    kostnadslinjer: Kostnadslinje[];
  };
};

// Fast «i dag» (datoen scenarioene ble skrevet), så rapporten kan gjenskapes.
const IDAG = "2026-11-04";

async function main() {
  const fil = new URL("../fasit/utkast/scenarioer.json", import.meta.url);
  const { scenarioer } = JSON.parse(readFileSync(fil, "utf8")) as { scenarioer: Scenario[] };
  // Valgfritt filter: node … scripts/fasit-utkast.ts delvis-1 helt-2
  const valgte = process.argv.slice(2);
  const kjør = valgte.length ? scenarioer.filter((s) => valgte.includes(s.id)) : scenarioer;
  const anthropic = new Anthropic();

  const resultater: {
    id: string;
    kategori: string;
    ord: number | null;
    regenerert: boolean;
    advarsler: string[];
    problemer?: string[];
    feil?: string;
    tekst?: string;
  }[] = [];

  for (const s of kjør) {
    const b = s.brev;
    const gs =
      b.kostnadslinjer.length > 0
        ? sjekkKostnader(b.kostnadslinjer, b.hovedstol ?? b.belopTotalt, b.brevdato)
        : null;
    const omfang = gjeldendeOmfang(s.type, gs, s.omfang);
    const avdrag =
      s.type === "nedbetalingsavtale" && s.manedsbelop
        ? beregnAvdrag(b.belopTotalt, s.manedsbelop)
        : null;
    const prompt = byggPrompt({
      type: s.type,
      originalTekst: b.tekst,
      gebyrsjekk: gs,
      stadium: s.stadium,
      belopTotalt: b.belopTotalt,
      detaljer: s.detaljer,
      navn: s.navn,
      avdrag,
      omfang,
    });
    const fakta = byggVaktFakta({
      originalTekst: b.tekst,
      belopTotalt: b.belopTotalt,
      belopHovedstol: b.hovedstol,
      kostnadslinjer: b.kostnadslinjer,
      gebyrsjekk: gs,
      ubestridt: omfang === "delvis" ? ubestridtDel(b.belopTotalt, gs) : null,
      avdrag,
      detaljer: s.detaljer,
      brevdato: b.brevdato,
      fristdato: b.fristdato,
      idag: IDAG,
      omfang,
    });
    try {
      const r = await genererUtkast(anthropic, prompt, fakta);
      if (!r) {
        resultater.push({ id: s.id, kategori: s.kategori, ord: null, regenerert: false, advarsler: [], feil: "ikke et brukbart svar" });
        continue;
      }
      resultater.push({
        id: s.id,
        kategori: s.kategori,
        ord: tellOrd(r.tekst),
        regenerert: r.regenerert,
        advarsler: r.advarsler.map((a) => a.rettelinje),
        problemer: r.problemer,
        tekst: r.tekst,
      });
      console.log(`[fasit-utkast] ${s.id}: ${r.advarsler.length} advarsler${r.regenerert ? " (regenerert)" : ""}`);
    } catch (e) {
      console.error(`[fasit-utkast] ${s.id}: feilet`, e);
      resultater.push({ id: s.id, kategori: s.kategori, ord: null, regenerert: false, advarsler: [], feil: (e as Error).message });
    }
  }

  const ok = resultater.filter((r) => !r.feil);
  const uten = ok.filter((r) => r.advarsler.length === 0);
  const ord = ok.map((r) => r.ord as number);
  const linjer: string[] = [];
  linjer.push("## Utkast (§E.4)", "");
  linjer.push(
    `Sist kjørt: ${tidsstempel()}. Scenarioer: ${kjør.length}. Generert: ${ok.length}.`,
    "",
    `**Uten advarsler etter regenerering: ${uten.length}/${ok.length}.** Regenerert: ${ok.filter((r) => r.regenerert).length}.`,
    "",
  );
  if (ord.length > 0) {
    linjer.push(
      `Ordtall: snitt ${Math.round(ord.reduce((a, b) => a + b, 0) / ord.length)}, min ${Math.min(...ord)}, maks ${Math.max(...ord)}.`,
      "",
    );
  }
  linjer.push(
    "| Scenario | Kategori | Ord | Regenerert fordi | Advarsler etterpå |",
    "|---|---|---|---|---|",
  );
  for (const r of resultater) {
    linjer.push(
      `| ${r.id} | ${r.kategori} | ${r.ord ?? "—"} | ${
        r.problemer?.length ? r.problemer.join("<br>") : "—"
      } | ${r.feil ? `feilet: ${r.feil}` : r.advarsler.length ? r.advarsler.join("<br>") : "ingen"} |`,
    );
  }
  linjer.push("");
  // Alle utkastene, så en person kan lese dem — vaktene sjekker fakta, ikke
  // om brevet faktisk sier det riktige.
  linjer.push("### Utkastene", "");
  for (const r of ok) {
    linjer.push(
      `<details><summary>${r.id}${r.advarsler.length ? " ⚠️" : ""}</summary>`,
      "",
      "```",
      r.tekst ?? "",
      "```",
      "",
      "</details>",
      "",
    );
  }
  skrivSeksjon("utkast", linjer.join("\n"));
  console.log(`[fasit-utkast] Rapport skrevet: ${uten.length}/${ok.length} uten advarsler.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
