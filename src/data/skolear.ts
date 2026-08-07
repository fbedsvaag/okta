import { db, hent, naa, oppdater, settInn, slett } from "../db";
import type { Fridag } from "./kalender";

export type Skolear = {
  id: string;
  navn: string;
  start: string;
  slutt: string;
};

export type Innstilling = Record<string, string>;

const AKTIVT = "aktivt_skolear";

export async function hentSkolear(): Promise<Skolear[]> {
  return hent<Skolear>(
    "SELECT id, navn, start, slutt FROM skolear WHERE slettet IS NULL ORDER BY start DESC",
  );
}

export async function opprettSkolear(
  navn: string,
  start: string,
  slutt: string,
): Promise<string> {
  const id = await settInn("skolear", { navn, start, slutt });

  // Det første skoleåret som opprettes blir automatisk det aktive (§4.8).
  if ((await hentAktivtSkolearId()) === null) await settAktivtSkolear(id);
  return id;
}

export async function endreSkolear(
  id: string,
  felter: Partial<Omit<Skolear, "id">>,
): Promise<void> {
  await oppdater("skolear", id, felter);
}

export async function hentAktivtSkolearId(): Promise<string | null> {
  const rader = await hent<{ verdi: string }>(
    "SELECT verdi FROM innstilling WHERE nokkel = $1",
    [AKTIVT],
  );
  return rader[0]?.verdi ?? null;
}

export async function settAktivtSkolear(id: string): Promise<void> {
  await (await db()).execute(
    `INSERT INTO innstilling (nokkel, verdi, endret) VALUES ($1, $2, $3)
     ON CONFLICT(nokkel) DO UPDATE SET verdi = $2, endret = $3`,
    [AKTIVT, id, naa()],
  );
}

export async function hentAktivtSkolear(): Promise<Skolear | null> {
  const id = await hentAktivtSkolearId();
  if (!id) return null;
  const rader = await hent<Skolear>(
    "SELECT id, navn, start, slutt FROM skolear WHERE id = $1 AND slettet IS NULL",
    [id],
  );
  return rader[0] ?? null;
}

export async function hentInnstilling(nokkel: string): Promise<string | null> {
  const rader = await hent<{ verdi: string }>(
    "SELECT verdi FROM innstilling WHERE nokkel = $1",
    [nokkel],
  );
  return rader[0]?.verdi ?? null;
}

/**
 * Foreslår "2026/27" ut fra dagens dato. Skoleåret regnes å begynne i august,
 * så i januar 2027 er forslaget fortsatt 2026/27.
 */
export function foreslattSkolearnavn(idag = new Date()): string {
  const startAr = idag.getMonth() >= 6 ? idag.getFullYear() : idag.getFullYear() - 1;
  return `${startAr}/${String((startAr + 1) % 100).padStart(2, "0")}`;
}

export function foreslatteDatoer(navn: string): { start: string; slutt: string } {
  const startAr = Number(navn.slice(0, 4));
  if (Number.isNaN(startAr)) return { start: "", slutt: "" };
  return { start: `${startAr}-08-17`, slutt: `${startAr + 1}-06-20` };
}

// ------------------------------------------------------------------ fridager

/**
 * Dager uten undervisning. Røde dager ligger ikke her — de regnes ut
 * (se kalender.ts) og skal ikke skrives inn for hånd.
 */
export async function hentFridager(skolearId: string): Promise<Fridag[]> {
  return hent<Fridag>(
    `SELECT id, skolear_id AS skolearId, navn, type, fra, til
       FROM fridag WHERE skolear_id = $1 AND slettet IS NULL ORDER BY fra`,
    [skolearId],
  );
}

export async function opprettFridag(
  skolearId: string,
  navn: string,
  type: Fridag["type"],
  fra: string,
  til: string,
): Promise<string> {
  return settInn("fridag", { skolear_id: skolearId, navn, type, fra, til });
}

export async function slettFridag(id: string): Promise<void> {
  await slett("fridag", id);
}

export async function settInnstilling(nokkel: string, verdi: string): Promise<void> {
  await (await db()).execute(
    `INSERT INTO innstilling (nokkel, verdi, endret) VALUES ($1, $2, $3)
     ON CONFLICT(nokkel) DO UPDATE SET verdi = $2, endret = $3`,
    [nokkel, verdi, naa()],
  );
}
