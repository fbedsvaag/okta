import { hent, oppdater, settInn, slett } from "../db";

/**
 * Notater og møtelogg per elev, SPEC §4.7.
 *
 * Ikke en egen skjerm — en bolk nederst på elevsiden. Samme sted dekker
 * faglige notater og oppfølging av mentorelever, siden begge er «ting jeg vil
 * huske om denne eleven over tid».
 *
 * Dette er noe annet enn skåringsnotatet i §4.4: det henger på én bestemt økt
 * og leses i heatmapet. Møteloggen er en bevisst hendelse — en samtale, en
 * observasjon, en avtale.
 */

export type Elevnotat = {
  id: string;
  elevId: string;
  skolearId: string;
  skolearFagId: string | null;
  /** fagkoden, når notatet henger på et fag */
  fagKode: string | null;
  dato: string;
  tekst: string;
  skalFolgesOpp: boolean;
  frist: string | null;
  lukket: string | null;
};

type Rad = Omit<Elevnotat, "skalFolgesOpp"> & { skalFolgesOpp: number };

/**
 * Notatene for én elev, nyeste først.
 *
 * Rekkefølgen settes i visningen, ikke her: åpne oppfølgingspunkter skal stå
 * øverst uavhengig av dato (§4.7), og den regelen hører hjemme ett sted.
 */
export async function hentElevnotater(elevId: string): Promise<Elevnotat[]> {
  const rader = await hent<Rad>(
    `SELECT n.id,
            n.elev_id          AS elevId,
            n.skolear_id       AS skolearId,
            n.skolear_fag_id   AS skolearFagId,
            f.kode             AS fagKode,
            n.dato, n.tekst, n.frist, n.lukket,
            n.skal_folges_opp  AS skalFolgesOpp
       FROM elevnotat n
       LEFT JOIN skolear_fag sf ON sf.id = n.skolear_fag_id AND sf.slettet IS NULL
       LEFT JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
      WHERE n.elev_id = $1 AND n.slettet IS NULL
      ORDER BY n.dato DESC, n.opprettet DESC`,
    [elevId],
  );
  return rader.map((r) => ({ ...r, skalFolgesOpp: r.skalFolgesOpp === 1 }));
}

export async function opprettElevnotat(
  elevId: string,
  skolearId: string,
  felter: {
    dato: string;
    tekst: string;
    skolearFagId?: string | null;
    skalFolgesOpp?: boolean;
    frist?: string | null;
  },
): Promise<string> {
  return settInn("elevnotat", {
    elev_id: elevId,
    skolear_id: skolearId,
    skolear_fag_id: felter.skolearFagId ?? null,
    dato: felter.dato,
    tekst: felter.tekst,
    skal_folges_opp: felter.skalFolgesOpp ? 1 : 0,
    frist: felter.frist ?? null,
    lukket: null,
  });
}

export async function endreElevnotat(
  id: string,
  felter: {
    dato?: string;
    tekst?: string;
    skolearFagId?: string | null;
    skalFolgesOpp?: boolean;
    frist?: string | null;
  },
): Promise<void> {
  const rad: Record<string, unknown> = {};
  if (felter.dato !== undefined) rad.dato = felter.dato;
  if (felter.tekst !== undefined) rad.tekst = felter.tekst;
  if (felter.skolearFagId !== undefined) rad.skolear_fag_id = felter.skolearFagId;
  if (felter.frist !== undefined) rad.frist = felter.frist;
  if (felter.skalFolgesOpp !== undefined) {
    rad.skal_folges_opp = felter.skalFolgesOpp ? 1 : 0;
    // Et punkt som ikke lenger skal følges opp har ingen frist å bomme på.
    if (!felter.skalFolgesOpp) rad.frist = null;
  }
  if (Object.keys(rad).length > 0) await oppdater("elevnotat", id, rad);
}

/** Lukker et oppfølgingspunkt, eller åpner det igjen. */
export async function settLukket(id: string, lukket: boolean): Promise<void> {
  await oppdater("elevnotat", id, {
    lukket: lukket ? new Date().toISOString().slice(0, 10) : null,
  });
}

export async function slettElevnotat(id: string): Promise<void> {
  await slett("elevnotat", id);
}

/**
 * Sorterer notatene slik §4.7 beskriver.
 *
 * Åpne oppfølgingspunkter ligger fast øverst, uavhengig av dato — de er det
 * som venter på deg. Resten er kronologisk, nyeste først. Lukker du et punkt,
 * synker det ned til sin naturlige plass.
 */
export function sorterNotater(notater: Elevnotat[]): Elevnotat[] {
  const apent = (n: Elevnotat) => n.skalFolgesOpp && n.lukket === null;
  return [...notater].sort((a, b) => {
    if (apent(a) !== apent(b)) return apent(a) ? -1 : 1;
    // Blant de åpne kommer de med frist først, tidligste frist øverst. Et
    // punkt uten frist er ikke mer eller mindre viktig, bare udatert.
    if (apent(a) && apent(b) && a.frist !== b.frist) {
      if (!a.frist) return 1;
      if (!b.frist) return -1;
      return a.frist.localeCompare(b.frist);
    }
    return b.dato.localeCompare(a.dato);
  });
}

/** Om et åpent punkt har passert fristen sin. Uten frist er svaret alltid nei. */
export function erForfalt(n: Elevnotat, idag: string): boolean {
  return (
    n.skalFolgesOpp && n.lukket === null && n.frist !== null && n.frist < idag
  );
}

/** Elevene med et åpent, forfalt punkt — til merket i elevtabellen (§4.3). */
export async function hentForfalte(skolearId: string): Promise<Set<string>> {
  const idag = new Date().toISOString().slice(0, 10);
  const rader = await hent<{ elevId: string }>(
    `SELECT DISTINCT elev_id AS elevId
       FROM elevnotat
      WHERE skolear_id = $1 AND slettet IS NULL
        AND skal_folges_opp = 1 AND lukket IS NULL
        AND frist IS NOT NULL AND frist < $2`,
    [skolearId, idag],
  );
  return new Set(rader.map((r) => r.elevId));
}
