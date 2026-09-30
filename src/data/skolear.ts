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

/**
 * Id-en til det aktive skoleåret, eller null.
 *
 * En peker til et slettet år er det samme som ingen peker, og derfor står
 * join-en mot `skolear` her. Uten den ble en død peker lest som «det finnes
 * et aktivt år», og da hoppet `opprettSkolear` over å gjøre det nye året
 * aktivt — veiviseren kunne kjøres om og om igjen uten å komme videre.
 */
export async function hentAktivtSkolearId(): Promise<string | null> {
  const rader = await hent<{ verdi: string }>(
    `SELECT i.verdi
       FROM innstilling i
       JOIN skolear s ON s.id = i.verdi AND s.slettet IS NULL
      WHERE i.nokkel = $1`,
    [AKTIVT],
  );
  return rader[0]?.verdi ?? null;
}

export async function settAktivtSkolear(id: string): Promise<void> {
  await (
    await db()
  ).execute(
    `INSERT INTO innstilling (nokkel, verdi, endret) VALUES ($1, $2, $3)
     ON CONFLICT(nokkel) DO UPDATE SET verdi = $2, endret = $3`,
    [AKTIVT, id, naa()],
  );
}

/**
 * `innstilling` har ingen `slettet`-kolonne (§3.2) — den er nøkkel/verdi, og
 * en verdi som ikke gjelder lenger skal bort, ikke merkes.
 */
async function fjernAktivtSkolear(): Promise<void> {
  await (
    await db()
  ).execute("DELETE FROM innstilling WHERE nokkel = $1", [AKTIVT]);
}

/**
 * Det aktive skoleåret — og pekeren repareres hvis den ikke holder.
 *
 * Peker innstillingen på et år som er slettet, overtar det nyeste
 * gjenværende. Finnes ingen år igjen, ryddes pekeren bort og appen viser
 * veiviseren (§4.0). Oppstarten skal aldri bli stående uten en vei videre.
 */
export async function hentAktivtSkolear(): Promise<Skolear | null> {
  const id = await hentAktivtSkolearId();
  if (id) {
    const rader = await hent<Skolear>(
      "SELECT id, navn, start, slutt FROM skolear WHERE id = $1 AND slettet IS NULL",
      [id],
    );
    if (rader[0]) return rader[0];
  }

  const [nyeste] = await hentSkolear();
  if (nyeste) {
    await settAktivtSkolear(nyeste.id);
    return nyeste;
  }

  await fjernAktivtSkolear();
  return null;
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
  const startAr =
    idag.getMonth() >= 6 ? idag.getFullYear() : idag.getFullYear() - 1;
  return `${startAr}/${String((startAr + 1) % 100).padStart(2, "0")}`;
}

export function foreslatteDatoer(navn: string): {
  start: string;
  slutt: string;
} {
  const startAr = Number(navn.slice(0, 4));
  if (Number.isNaN(startAr)) return { start: "", slutt: "" };
  return { start: `${startAr}-08-17`, slutt: `${startAr + 1}-06-20` };
}

/**
 * Tekststørrelsen, som et tall typeskalaen ganges med (§4.8).
 *
 * Settes på dokumentroten, ikke i en komponent: hele skalaen henger på den,
 * og den skal gjelde før noe er tegnet.
 */
export const TEKSTSKALA = "tekst_skala";

export async function brukTekstskala(): Promise<void> {
  const v = await hentInnstilling(TEKSTSKALA);
  settTekstskala(v ?? "0.93");
}

export function settTekstskala(verdi: string): void {
  document.documentElement.style.setProperty("--tekst-skala", verdi);
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

export async function settInnstilling(
  nokkel: string,
  verdi: string,
): Promise<void> {
  await (
    await db()
  ).execute(
    `INSERT INTO innstilling (nokkel, verdi, endret) VALUES ($1, $2, $3)
     ON CONFLICT(nokkel) DO UPDATE SET verdi = $2, endret = $3`,
    [nokkel, verdi, naa()],
  );
}

// --------------------------------------------------------------- opprydding

export type Arsomfang = {
  fag: number;
  okter: number;
  skaringer: number;
  klasser: number;
  elevkoblinger: number;
  vurderinger: number;
};

/** Hva en sletting av skoleåret tar med seg. */
export async function tellForSkolear(skolearId: string): Promise<Arsomfang> {
  const [r] = await hent<Arsomfang>(
    `WITH sf AS (
       SELECT id FROM skolear_fag WHERE skolear_id = $1 AND slettet IS NULL
     )
     SELECT
       (SELECT COUNT(*) FROM sf) AS fag,
       (SELECT COUNT(*) FROM okt WHERE skolear_fag_id IN (SELECT id FROM sf)
          AND slettet IS NULL) AS okter,
       (SELECT COUNT(*) FROM skaring s JOIN okt o ON o.id = s.okt_id
         WHERE o.skolear_fag_id IN (SELECT id FROM sf)
           AND s.slettet IS NULL AND o.slettet IS NULL) AS skaringer,
       (SELECT COUNT(*) FROM klasse WHERE skolear_id = $1 AND slettet IS NULL)
         AS klasser,
       (SELECT COUNT(*) FROM elev_klasse WHERE skolear_id = $1 AND slettet IS NULL)
         AS elevkoblinger,
       (SELECT COUNT(*) FROM vurdering WHERE skolear_fag_id IN (SELECT id FROM sf)
          AND slettet IS NULL) AS vurderinger`,
    [skolearId],
  );
  return r;
}

/**
 * Sletter et helt skoleår.
 *
 * Fagene i banken blir stående — de er uavhengige av år (§3.2), og skal kunne
 * velges inn i et nytt år. Elevene blir også stående; de lever på tvers av år.
 * Det som forsvinner er koblingene, øktene, periodene og vurderingene som
 * hørte til nettopp dette året.
 */
export async function slettSkolear(skolearId: string): Promise<void> {
  const arene = await hent<{ id: string }>(
    "SELECT id FROM skolear_fag WHERE skolear_id = $1 AND slettet IS NULL",
    [skolearId],
  );

  for (const sf of arene) {
    const okter = await hent<{ id: string }>(
      "SELECT id FROM okt WHERE skolear_fag_id = $1 AND slettet IS NULL",
      [sf.id],
    );
    for (const o of okter) {
      const sk = await hent<{ id: string }>(
        "SELECT id FROM skaring WHERE okt_id = $1 AND slettet IS NULL",
        [o.id],
      );
      for (const s of sk) await slett("skaring", s.id);
      await slett("okt", o.id);
    }

    const vurderinger = await hent<{ id: string }>(
      "SELECT id FROM vurdering WHERE skolear_fag_id = $1 AND slettet IS NULL",
      [sf.id],
    );
    for (const v of vurderinger) {
      const res = await hent<{ id: string }>(
        "SELECT id FROM vurderingsresultat WHERE vurdering_id = $1 AND slettet IS NULL",
        [v.id],
      );
      for (const r of res) await slett("vurderingsresultat", r.id);
      await slett("vurdering", v.id);
    }

    for (const tabell of ["periode", "elev_fag"]) {
      const rader = await hent<{ id: string }>(
        `SELECT id FROM ${tabell} WHERE skolear_fag_id = $1 AND slettet IS NULL`,
        [sf.id],
      );
      for (const r of rader) await slett(tabell, r.id);
    }
    await slett("skolear_fag", sf.id);
  }

  // elevnotat ryddes på skolear_id, ikke på faget: et notat uten fag hører
  // til året, og ville ellers blitt stående etter at året er slettet.
  for (const tabell of ["elev_klasse", "klasse", "fridag", "elevnotat"]) {
    const rader = await hent<{ id: string }>(
      `SELECT id FROM ${tabell} WHERE skolear_id = $1 AND slettet IS NULL`,
      [skolearId],
    );
    for (const r of rader) await slett(tabell, r.id);
  }

  await slett("skolear", skolearId);

  // Pekeren til aktivt år skal aldri bli stående på noe som er slettet.
  // Den ryddes her, i datalaget, og ikke i hvert kallsted — et kallsted som
  // glemmer det etterlater en base appen ikke kommer inn i.
  await hentAktivtSkolear();
}
