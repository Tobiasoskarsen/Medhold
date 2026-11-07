// Lager supabase/testmiljo/oppsett.sql: alle migrasjonene i riktig rekkefølge for
// et TOMT Supabase-prosjekt, uten 0014 (erstattet av 0025, aldri kjørt i
// produksjon). Kjøres på nytt når en migrasjon legges til:
//   node scripts/lag-testmiljo-sql.mjs
// supabase/tests/testmiljo.test.mjs sjekker at fila er oppdatert og kjører.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
export const UT = "supabase/testmiljo/oppsett.sql";

export function lagTestmiljoSql() {
  const filer = readdirSync(DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.startsWith("0014"))
    .sort();
  const deler = filer.map(
    (f) => `-- ============================================================\n-- ${f}\n-- ============================================================\n\n${readFileSync(join(DIR, f), "utf8").replace(/\r\n/g, "\n").trim()}\n`,
  );
  return `-- KUN FOR ET TOMT TESTPROSJEKT I SUPABASE. ALDRI I PRODUKSJON.
--
-- Bygger hele Medhold-databasen fra bunnen: ${filer[0].slice(0, 4)}–${filer.at(-1).slice(0, 4)} uten 0014
-- (erstattet av 0025). Generert av scripts/lag-testmiljo-sql.mjs fra
-- supabase/migrations. Ikke rediger denne fila; endre migrasjonene og generer på nytt.
--
-- Før du kjører: sjekk at prosjektnavnet øverst i SQL Editor er testprosjektet.
-- Lim inn hele fila og kjør. Feiler noe, er resten ikke kjørt: send feilmeldingen.

${deler.join("\n")}`;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("lag-testmiljo-sql.mjs")) {
  mkdirSync("supabase/testmiljo", { recursive: true });
  writeFileSync(UT, lagTestmiljoSql());
  console.log(`Skrev ${UT}`);
}
