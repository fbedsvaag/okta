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

  // SPEC §12: fremmednøkler skal være på. Innstillingen gjelder per
  // tilkobling, og plugin-sql har en pulje (#12). sqlx slår dem på for hver
  // ny tilkobling som standard; en Rust-test (transaksjon.rs) holder fire
  // tilkoblinger samtidig og sjekker hver av dem, og transaksjonene sjekker
  // sin egen tilkobling før de skriver. Sjekken her ser bare tilkoblingen
  // som tilfeldigvis svarer, men stopper appen tidlig hvis noe er galt.
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
  noter([{ tabell, id, felter: { slettet: NAA } }]);
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
  // Til angring: raden slik den var, eller ingen.
  const finn = async () =>
    (
      await hent<Record<string, unknown>>(
        `SELECT * FROM ${tabell} WHERE ${nokkel
          .map((k, i) => `${k} = $${i + 1}`)
          .join(" AND ")}`,
        nokkel.map((k) => felter[k]),
      )
    )[0];
  const for_ = angrer ? undefined : await finn();
  const endres = [
    ...Object.keys(felter).filter((k) => !nokkel.includes(k)),
    "slettet",
  ];
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
  if (angrer) return;
  if (for_)
    noter([{ tabell, id: for_.id as string, felter: plukk(for_, endres) }]);
  else {
    const ny = await finn();
    if (ny) noter([{ tabell, id: ny.id as string, felter: { slettet: NAA } }]);
  }
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
  const for_ = angrer ? undefined : (await gamle(tabell, [id])).get(id);
  await (
    await db()
  ).execute(`UPDATE ${tabell} SET ${sett} WHERE id = $${kolonner.length + 1}`, [
    ...Object.values(rad),
    id,
  ]);
  if (for_) noter([{ tabell, id, felter: plukk(for_, Object.keys(felter)) }]);
}

/** Soft delete. Ingenting i appen sletter rader for godt (SPEC §9). */
export async function slett(tabell: string, id: string): Promise<void> {
  const tid = naa();
  const for_ = angrer ? undefined : (await gamle(tabell, [id])).get(id);
  await (
    await db()
  ).execute(`UPDATE ${tabell} SET slettet = $1, endret = $2 WHERE id = $3`, [
    tid,
    tid,
    id,
  ]);
  if (for_) noter([{ tabell, id, felter: plukk(for_, ["slettet"]) }]);
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
  /** Det som skrives, til angring (rå `execute` angres ikke). */
  private readonly ops: {
    type: "inn" | "opp";
    tabell: string;
    id: string;
    felt: string[];
  }[] = [];

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
    this.ops.push({ type: "inn", tabell, id, felt: [] });
    return id;
  }

  oppdater(tabell: string, id: string, felter: Record<string, unknown>): void {
    this.ops.push({ type: "opp", tabell, id, felt: Object.keys(felter) });
    const rad = { ...felter, endret: this.tid };
    const kolonner = Object.keys(rad);
    const sett = kolonner.map((k, i) => `${k} = $${i + 1}`).join(", ");
    this.execute(
      `UPDATE ${tabell} SET ${sett} WHERE id = $${kolonner.length + 1}`,
      [...Object.values(rad), id],
    );
  }

  slett(tabell: string, id: string): void {
    this.ops.push({ type: "opp", tabell, id, felt: ["slettet"] });
    this.execute(
      `UPDATE ${tabell} SET slettet = $1, endret = $2 WHERE id = $3`,
      [this.tid, this.tid, id],
    );
  }

  /** Kjører alt samlet. Feiler én setning, er ingenting lagret. */
  async kjor(): Promise<void> {
    if (this.setninger.length === 0) return;
    // Til angring: radene slik de var før, lest samlet per tabell.
    const motsatt: Motsatt[] = [];
    if (!angrer) {
      const perTabell = new Map<string, string[]>();
      for (const o of this.ops)
        if (o.type === "opp")
          perTabell.set(o.tabell, [...(perTabell.get(o.tabell) ?? []), o.id]);
      const for_ = new Map<string, Map<string, Record<string, unknown>>>();
      for (const [t, ider] of perTabell) for_.set(t, await gamle(t, ider));
      for (const o of this.ops) {
        if (o.type === "inn")
          motsatt.push({
            tabell: o.tabell,
            id: o.id,
            felter: { slettet: NAA },
          });
        else {
          const r = for_.get(o.tabell)?.get(o.id);
          if (r)
            motsatt.push({
              tabell: o.tabell,
              id: o.id,
              felter: plukk(r, o.felt),
            });
        }
      }
    }
    const d = (await db()) as Database & {
      transaksjon?: (s: Setning[]) => Promise<void>;
    };
    // Testbasen (src/db/testbase.ts) kjører transaksjonen selv; i appen gjør
    // Rust det, på én tilkobling fra den samme puljen.
    if (d.transaksjon) await d.transaksjon(this.setninger);
    else await invoke("transaksjon", { setninger: this.setninger });
    noter(motsatt);
  }
}

// ------------------------------------------------------------ angring

/**
 * Universell angring (⌘Z, 21.10). Hver skriving gjennom laget her husker
 * hvordan raden var før: en endring skrives tilbake, en ny rad slettes mykt,
 * en sletting tas tilbake. Skrivinger tett etter hverandre (en handling som
 * skriver flere steder) er én angring. Innstillingene og sikkerhetskopien
 * skrives utenom og angres ikke. Loggen lever bare mens appen er åpen.
 */

/** «Sett til nå» — tiden for den myke slettingen når angringen kjøres. */
const NAA = "\u0000naa";

type Motsatt = { tabell: string; id: string; felter: Record<string, unknown> };

export type Skriving = {
  /** sist det ble skrevet i handlingen (ms) */
  tid: number;
  motsatt: Motsatt[];
  tabeller: Set<string>;
  /** det handlingen selv kalte seg («Byttet 12.10 og 14.10»), ellers null */
  tekst: string | null;
  /** en egen angre-funksjon, for det som ikke skriver i basen */
  egen?: () => Promise<void> | void;
};

/** Hvor tett skrivinger må komme for å være én handling. */
const GRUPPE_MS = 600;
const logg: Skriving[] = [];
/** Det som er angret, og kan gjøres om igjen (⇧⌘Z). */
const omigjen: Skriving[] = [];
const loggLyttere = new Set<() => void>();
let angrer = false;

function varsleLogg() {
  loggLyttere.forEach((f) => f());
}

function noter(motsatt: Motsatt[]) {
  if (angrer || motsatt.length === 0) return;
  // Noe nytt er gjort: det som var angret, kan ikke gjøres om lenger.
  omigjen.length = 0;
  const naa = Date.now();
  const sist = logg[logg.length - 1];
  if (sist && !sist.egen && naa - sist.tid < GRUPPE_MS) {
    sist.motsatt.push(...motsatt);
    sist.tid = naa;
    for (const m of motsatt) sist.tabeller.add(m.tabell);
  } else {
    logg.push({
      tid: naa,
      motsatt: [...motsatt],
      tabeller: new Set(motsatt.map((m) => m.tabell)),
      tekst: null,
    });
    if (logg.length > 100) logg.shift();
  }
  varsleLogg();
}

const plukk = (rad: Record<string, unknown>, felt: string[]) =>
  Object.fromEntries(felt.map((f) => [f, rad[f] ?? null]));

async function gamle(
  tabell: string,
  ider: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const ut = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ider.length; i += 400) {
    const del = ider.slice(i, i + 400);
    const rader = await hent<Record<string, unknown>>(
      `SELECT * FROM ${tabell} WHERE id IN (${del.map((_, j) => `$${j + 1}`).join(", ")})`,
      del,
    );
    for (const r of rader) ut.set(r.id as string, r);
  }
  return ut;
}

/** Den siste handlingen som kan angres, eller null. */
export function sisteSkriving(): Skriving | null {
  return logg[logg.length - 1] ?? null;
}

/** En egen angring for noe som ikke skriver i basen (eller en test). */
export function leggTilEgenAngring(
  tekst: string,
  egen: () => Promise<void> | void,
): void {
  logg.push({ tid: Date.now(), motsatt: [], tabeller: new Set(), tekst, egen });
  omigjen.length = 0;
  varsleLogg();
}

/**
 * Skriver `motsatt` tilbake, og gir det som trengs for å gå den andre
 * veien: radene slik de var rett før.
 */
async function skrivTilbake(motsatt: Motsatt[]): Promise<Motsatt[]> {
  const perTabell = new Map<string, string[]>();
  for (const m of motsatt)
    perTabell.set(m.tabell, [...(perTabell.get(m.tabell) ?? []), m.id]);
  const na = new Map<string, Map<string, Record<string, unknown>>>();
  for (const [t, ider] of perTabell) na.set(t, await gamle(t, ider));
  const tilbake: Motsatt[] = [];
  const t = new Transaksjon();
  const naa_ = naa();
  for (const m of [...motsatt].reverse()) {
    const r = na.get(m.tabell)?.get(m.id);
    if (r)
      tilbake.unshift({
        tabell: m.tabell,
        id: m.id,
        felter: plukk(r, Object.keys(m.felter)),
      });
    t.oppdater(
      m.tabell,
      m.id,
      Object.fromEntries(
        Object.entries(m.felter).map(([k, v]) => [k, v === NAA ? naa_ : v]),
      ),
    );
  }
  await t.kjor();
  return tilbake;
}

/** Angrer den siste handlingen. Gir den tilbake, eller null. */
export async function angreSkriving(): Promise<Skriving | null> {
  const s = logg.pop();
  varsleLogg();
  if (!s) return null;
  angrer = true;
  try {
    if (s.egen) await s.egen();
    else omigjen.push({ ...s, motsatt: await skrivTilbake(s.motsatt) });
  } finally {
    angrer = false;
    varsleLogg();
  }
  return s;
}

/** Gjør om det som sist ble angret (⇧⌘Z). Gir det tilbake, eller null. */
export async function gjorOmSkriving(): Promise<Skriving | null> {
  const s = omigjen.pop();
  varsleLogg();
  if (!s) return null;
  angrer = true;
  try {
    logg.push({ ...s, tid: 0, motsatt: await skrivTilbake(s.motsatt) });
  } finally {
    angrer = false;
    varsleLogg();
  }
  return s;
}

/** Det som kan gjøres om, eller null. */
export function sisteOmigjen(): Skriving | null {
  return omigjen[omigjen.length - 1] ?? null;
}

export function lyttSkrivinger(f: () => void): () => void {
  loggLyttere.add(f);
  return () => loggLyttere.delete(f);
}

/** Bare til testene. */
export function tomSkrivelogg(): void {
  logg.length = 0;
  omigjen.length = 0;
}
