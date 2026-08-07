/**
 * Kjør navneparseren mot en fil eller mot tekst du limer inn.
 *
 *   npm run parse dummydata/1STC-MFL1.md
 *   npm run parse                 (lim inn, avslutt med Ctrl-D)
 *
 * Skriver ut hva parseren faktisk gjør med hver linje, så du kan se
 * om den tar feil før den får skrive noe til databasen.
 */
import { readFileSync } from "node:fs";
import { parseListe } from "../src/import/parser.ts";

const fil = process.argv[2];
const tekst = readFileSync(fil ?? 0, "utf8");
const { elever, hoppetOver } = parseListe(tekst);

const bredde = (rader: string[]) => Math.max(0, ...rader.map((r) => r.length));
const bFor = Math.max(7, bredde(elever.map((e) => e.fornavn)));
const bEtter = Math.max(9, bredde(elever.map((e) => e.etternavn)));

console.log();
console.log(
  `  ${"FORNAVN".padEnd(bFor)}  ${"ETTERNAVN".padEnd(bEtter)}  KLASSE`,
);
console.log(`  ${"-".repeat(bFor)}  ${"-".repeat(bEtter)}  ------`);

for (const e of elever) {
  const merke = e.etternavn === "" ? "  ← mangler etternavn" : "";
  console.log(
    `  ${e.fornavn.padEnd(bFor)}  ${e.etternavn.padEnd(bEtter)}  ${
      e.klasse ?? "–"
    }${merke}`,
  );
}

console.log();
console.log(`  ${elever.length} elever`);
if (hoppetOver.length > 0) {
  console.log(`  ${hoppetOver.length} linjer hoppet over:`);
  for (const h of hoppetOver) {
    console.log(`    linje ${h.linjenr} (${h.grunn}): ${h.original.trim()}`);
  }
}
console.log();
