// Felles for fasit-skriptene: hver skriver sin egen seksjon i fasit/rapport.md
// mellom to markører, så lesing og utkast kan kjøres hver for seg uten å
// overskrive hverandre.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const RAPPORT = new URL("../fasit/rapport.md", import.meta.url);

const TOPP = `# Fasitrapport

Generert av \`scripts/fasit-lesing.ts\` og \`scripts/fasit-utkast.ts\`
(MEDHOLD_SIKKERHET_ARBEIDSORDRE §E.3–E.4). Ikke rediger for hånd — kjør
skriptene på nytt.
`;

export function skrivSeksjon(navn: "lesing" | "rente" | "utkast", innhold: string): void {
  const start = `<!-- ${navn}:start -->`;
  const slutt = `<!-- ${navn}:slutt -->`;
  const blokk = `${start}\n${innhold.trim()}\n${slutt}`;
  let tekst = existsSync(RAPPORT) ? readFileSync(RAPPORT, "utf8") : TOPP;
  const i = tekst.indexOf(start);
  const j = tekst.indexOf(slutt);
  if (i >= 0 && j > i) {
    tekst = tekst.slice(0, i) + blokk + tekst.slice(j + slutt.length);
  } else {
    // Rekkefølge: lesing, rente, utkast — uansett hvilket skript som kjøres først.
    const annen =
      navn === "lesing"
        ? tekst.includes("<!-- rente:start -->")
          ? "<!-- rente:start -->"
          : "<!-- utkast:start -->"
        : navn === "rente"
          ? "<!-- utkast:start -->"
          : null;
    const k = annen ? tekst.indexOf(annen) : -1;
    tekst =
      k >= 0
        ? `${tekst.slice(0, k)}${blokk}\n\n${tekst.slice(k)}`
        : `${tekst.trimEnd()}\n\n${blokk}\n`;
  }
  writeFileSync(RAPPORT, tekst);
}

/** Nåtid i norsk tid, for «Sist kjørt». */
export function tidsstempel(): string {
  return new Date().toLocaleString("nb-NO", { timeZone: "Europe/Oslo" });
}
