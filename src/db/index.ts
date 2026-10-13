import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

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

/**
 * Dagens dato i lokal tid: 2026-10-14. Aldri `toISOString()`, som er UTC
 * og gir gårsdagen mellom midnatt og kl. 01 (vinter) eller 02 (sommer) (#7).
 */
export function idag(): string {
  return naa().slice(0, 10);
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
  await (
    await db()
  ).execute(
    `INSERT INTO ${tabell} (${kolonner.join(", ")}) VALUES (${plassholdere})`,
    Object.values(rad),
  );
  return id;
}

/**
 * INSERT, eller UPDATE av raden som har samme `nokkel` (#8). Én setning,
 * så det finnes ikke noe vindu mellom «finnes raden?» og skrivingen: to
 * raske tastetrykk på samme elev kan ikke begge prøve INSERT.
 *
 * UNIQUE gjelder også soft-slettede rader, så en slettet rad tas i bruk
 * igjen (`slettet = NULL`) i stedet for at en ny settes inn (§12).
 */
export async function settInnEllerOppdater(
  tabell: string,
  nokkel: string[],
  felter: Record<string, unknown>,
): Promise<void> {
  const tid = naa();
  const rad = { ...felter, id: nyId(), opprettet: tid, endret: tid };
  const kolonner = Object.keys(rad);
  const plassholdere = kolonner.map((_, i) => `$${i + 1}`).join(", ");
  const sett = [
    ...Object.keys(felter)
      .filter((k) => !nokkel.includes(k))
      .map((k) => `${k} = excluded.${k}`),
    "endret = excluded.endret",
    "slettet = NULL",
  ].join(", ");
  await (
    await db()
  ).execute(
    `INSERT INTO ${tabell} (${kolonner.join(", ")}) VALUES (${plassholdere})
     ON CONFLICT(${nokkel.join(", ")}) DO UPDATE SET ${sett}`,
    Object.values(rad),
  );
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
  await (
    await db()
  ).execute(`UPDATE ${tabell} SET ${sett} WHERE id = $${kolonner.length + 1}`, [
    ...Object.values(rad),
    id,
  ]);
}

/** Soft delete. Ingenting i appen sletter rader for godt (SPEC §9). */
export async function slett(tabell: string, id: string): Promise<void> {
  const tid = naa();
  await (
    await db()
  ).execute(`UPDATE ${tabell} SET slettet = $1, endret = $2 WHERE id = $3`, [
    tid,
    tid,
    id,
  ]);
}

// ------------------------------------------------------------ transaksjoner

export type Setning = { sql: string; verdier: unknown[] };

/**
 * Skrivinger som skal gå gjennom samlet, eller ikke i det hele tatt
 * (issue #2). Samme SQL som `settInn`, `oppdater` og `slett`, men samlet
 * opp og sendt i ett kall med `kjor()`.
 *
 * Les først, bygg setningene, kjør til slutt. Midt i en transaksjon kan
 * man ikke lese det man nettopp har skrevet; det er heller ikke behov for
 * det, siden id-ene lages her.
 */
export class Transaksjon {
  readonly setninger: Setning[] = [];
  private readonly tid = naa();

  execute(sql: string, verdier: unknown[] = []): void {
    this.setninger.push({ sql, verdier });
  }

  settInn(tabell: string, felter: Record<string, unknown>): string {
    const id = (felter.id as string | undefined) ?? nyId();
    const rad = { ...felter, id, opprettet: this.tid, endret: this.tid };
    const kolonner = Object.keys(rad);
    const plassholdere = kolonner.map((_, i) => `$${i + 1}`).join(", ");
    this.execute(
      `INSERT INTO ${tabell} (${kolonner.join(", ")}) VALUES (${plassholdere})`,
      Object.values(rad),
    );
    return id;
  }

  oppdater(tabell: string, id: string, felter: Record<string, unknown>): void {
    const rad = { ...felter, endret: this.tid };
    const kolonner = Object.keys(rad);
    const sett = kolonner.map((k, i) => `${k} = $${i + 1}`).join(", ");
    this.execute(
      `UPDATE ${tabell} SET ${sett} WHERE id = $${kolonner.length + 1}`,
      [...Object.values(rad), id],
    );
  }

  slett(tabell: string, id: string): void {
    this.execute(
      `UPDATE ${tabell} SET slettet = $1, endret = $2 WHERE id = $3`,
      [this.tid, this.tid, id],
    );
  }

  /** Kjører alt samlet. Feiler én setning, er ingenting lagret. */
  async kjor(): Promise<void> {
    if (this.setninger.length === 0) return;
    const d = (await db()) as Database & {
      transaksjon?: (s: Setning[]) => Promise<void>;
    };
    // Testbasen (src/db/testbase.ts) kjører transaksjonen selv; i appen gjør
    // Rust det, på én tilkobling fra den samme puljen.
    if (d.transaksjon) return d.transaksjon(this.setninger);
    await invoke("transaksjon", { setninger: this.setninger });
  }
}
