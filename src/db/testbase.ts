/**
 * Testbase — ekte SQLite i minnet, med de ekte migrasjonene.
 *
 * Brukes bare av tester. Datalaget snakker med `@tauri-apps/plugin-sql`, som
 * ikke finnes utenfor Tauri, så testene bytter den ut med denne. Under ligger
 * `node:sqlite`, altså samme motor som i appen — poenget er å teste
 * spørringene som de faktisk er, ikke en etterlikning av dem.
 *
 * Migrasjonene leses fra `src-tauri/migrations/`, så en test som går grønn
 * her har gått mot det schemaet appen faktisk får.
 */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRASJONER = join(
  import.meta.dirname,
  "..",
  "..",
  "src-tauri",
  "migrations",
);

/**
 * Plugin-en bruker `$1`, `$2` … og tillater at samme nummer går igjen.
 * SQLite regner `$1` som et navngitt parameter, så argumentlista blir et
 * oppslag på navn — da holder rekkefølgen selv når `$1` brukes flere ganger.
 */
function navngi(args: unknown[]): Record<string, SQLInputValue> {
  return Object.fromEntries(
    args.map((v, i) => [String(i + 1), (v ?? null) as SQLInputValue]),
  );
}

export type Testbase = {
  select<T>(sql: string, args?: unknown[]): Promise<T>;
  execute(sql: string, args?: unknown[]): Promise<{ rowsAffected: number }>;
  /** Som Rust-kommandoen `transaksjon`: alt eller ingenting. */
  transaksjon(setninger: { sql: string; verdier: unknown[] }[]): Promise<void>;
  /** Tømmer alle tabeller og kjører seedingen på nytt. */
  nullstill(): void;
};

export function lagTestbase(): Testbase {
  const filer = readdirSync(MIGRASJONER)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sql = filer.map((f) => readFileSync(join(MIGRASJONER, f), "utf8"));

  function bygg(): DatabaseSync {
    const ny = new DatabaseSync(":memory:");
    ny.exec("PRAGMA foreign_keys = ON");
    for (const s of sql) ny.exec(s);
    return ny;
  }

  // Basen bygges på nytt mellom testene framfor å tømmes. Det tar mikrosekunder
  // i minnet, og sparer oss for å gjette hvordan seedingen skal spilles av på
  // nytt — migrasjonene er fasit, og de kjøres som de er.
  let base = bygg();

  return {
    async select<T>(spørring: string, args: unknown[] = []): Promise<T> {
      return base.prepare(spørring).all(navngi(args)) as T;
    },

    async execute(spørring: string, args: unknown[] = []) {
      const r = base.prepare(spørring).run(navngi(args));
      return { rowsAffected: Number(r.changes) };
    },

    async transaksjon(setninger) {
      base.exec("BEGIN");
      try {
        for (const s of setninger) base.prepare(s.sql).run(navngi(s.verdier));
        base.exec("COMMIT");
      } catch (e) {
        base.exec("ROLLBACK");
        throw e;
      }
    },

    nullstill() {
      base.close();
      base = bygg();
    },
  };
}
