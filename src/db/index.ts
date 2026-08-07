import Database from "@tauri-apps/plugin-sql";

/**
 * Tilkoblingen til arbeidsfila. Filen legges av Tauri i appens data-mappe
 * (~/Library/Application Support/no.elevtracking.app/), aldri i en synkmappe.
 */
const FIL = "sqlite:elevtracking.sqlite";

let tilkobling: Promise<Database> | null = null;

export function db(): Promise<Database> {
  if (!tilkobling) tilkobling = koble();
  return tilkobling;
}

async function koble(): Promise<Database> {
  const d = await Database.load(FIL);

  // SPEC §12: fremmednøkler skal være på. sqlx slår dem på for hver tilkobling
  // i puljen, men vi stoler ikke på det uten å se det.
  await d.execute("PRAGMA foreign_keys = ON");
  const [{ foreign_keys }] = await d.select<{ foreign_keys: number }[]>(
    "PRAGMA foreign_keys",
  );
  if (foreign_keys !== 1) {
    throw new Error(
      "PRAGMA foreign_keys er av. Databasen ville godtatt rader som peker i " +
        "løse lufta, så appen stopper her i stedet for å skrive ødelagte data.",
    );
  }

  return d;
}

/** Lokal ISO uten tidssone, slik SPEC §12 vil ha det: 2026-08-06T14:03:22 */
export function naa(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

export function nyId(): string {
  return crypto.randomUUID();
}

/** SELECT som alltid filtrerer bort soft-slettede rader er kallerens ansvar. */
export async function hent<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  return (await db()).select<T[]>(sql, args);
}

/**
 * INSERT. Fyller id, opprettet og endret selv, slik at ingen kallsted
 * trenger å huske dem (SPEC §12).
 */
export async function settInn(
  tabell: string,
  felter: Record<string, unknown>,
): Promise<string> {
  const id = (felter.id as string | undefined) ?? nyId();
  const tid = naa();
  const rad = { ...felter, id, opprettet: tid, endret: tid };

  const kolonner = Object.keys(rad);
  const plassholdere = kolonner.map((_, i) => `$${i + 1}`).join(", ");
  await (await db()).execute(
    `INSERT INTO ${tabell} (${kolonner.join(", ")}) VALUES (${plassholdere})`,
    Object.values(rad),
  );
  return id;
}

/** UPDATE. Skriver endret automatisk — derfor ligger det her og ikke i hver visning. */
export async function oppdater(
  tabell: string,
  id: string,
  felter: Record<string, unknown>,
): Promise<void> {
  const rad = { ...felter, endret: naa() };
  const kolonner = Object.keys(rad);
  const sett = kolonner.map((k, i) => `${k} = $${i + 1}`).join(", ");
  await (await db()).execute(
    `UPDATE ${tabell} SET ${sett} WHERE id = $${kolonner.length + 1}`,
    [...Object.values(rad), id],
  );
}

/** Soft delete. Ingenting i appen sletter rader for godt (SPEC §9). */
export async function slett(tabell: string, id: string): Promise<void> {
  const tid = naa();
  await (await db()).execute(
    `UPDATE ${tabell} SET slettet = $1, endret = $2 WHERE id = $3`,
    [tid, tid, id],
  );
}
