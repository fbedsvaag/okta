import { hent, oppdater, settInn, slett } from "../db";
// Notatene står i elevkortet og i gjøremålene på forsiden; begge lytter.
import { varsleElever } from "./endringer";

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
  /**
   * Samtalen notatet ble skrevet i, når det kom derfra.
   *
   * Lenken er svak: en ny trekning erstatter samtaleradene, og da peker den
   * på noe slettet. Visningen bygger derfor på notatets egne felter — at det
   * kom fra en samtale, og hvilket fag det eventuelt hører til.
   */
  samtaleId: string | null;
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
            COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode,
            n.dato, n.tekst, n.frist, n.lukket,
            n.samtale_id       AS samtaleId,
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
    samtaleId?: string | null;
  },
): Promise<string> {
  const id = await settInn("elevnotat", {
    elev_id: elevId,
    skolear_id: skolearId,
    skolear_fag_id: felter.skolearFagId ?? null,
    dato: felter.dato,
    tekst: felter.tekst,
    skal_folges_opp: felter.skalFolgesOpp ? 1 : 0,
    frist: felter.frist ?? null,
    lukket: null,
    samtale_id: felter.samtaleId ?? null,
  });
  varsleElever();
  return id;
}

/**
 * Notatene elevene har på en gitt dato, slått opp på elev.
 *
 * Timeplanen bruker den, og oppslaget går på dato framfor på samtale-id med
 * vilje: da vises også et notat du skrev på elevsiden den dagen. Notatet skal
 * kunne ses begge steder, uansett hvor det ble skrevet.
 *
 * Har en elev flere notater samme dag, vinner det som hører til samtalen.
 */
export async function hentNotatPerElev(
  elevIder: string[],
  dato: string,
): Promise<Map<string, Elevnotat>> {
  if (elevIder.length === 0 || dato === "") return new Map();

  const plass = elevIder.map((_, i) => `$${i + 2}`).join(", ");
  const rader = await hent<Rad>(
    `SELECT n.id,
            n.elev_id          AS elevId,
            n.skolear_id       AS skolearId,
            n.skolear_fag_id   AS skolearFagId,
            NULL               AS fagKode,
            n.dato, n.tekst, n.frist, n.lukket,
            n.samtale_id       AS samtaleId,
            n.skal_folges_opp  AS skalFolgesOpp
       FROM elevnotat n
      WHERE n.dato = $1 AND n.elev_id IN (${plass}) AND n.slettet IS NULL
      ORDER BY (n.samtale_id IS NULL), n.opprettet DESC`,
    [dato, ...elevIder],
  );

  const ut = new Map<string, Elevnotat>();
  for (const r of rader) {
    if (ut.has(r.elevId)) continue;
    ut.set(r.elevId, { ...r, skalFolgesOpp: r.skalFolgesOpp === 1 });
  }
  return ut;
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
  if (felter.skolearFagId !== undefined)
    rad.skolear_fag_id = felter.skolearFagId;
  if (felter.frist !== undefined) rad.frist = felter.frist;
  if (felter.skalFolgesOpp !== undefined) {
    rad.skal_folges_opp = felter.skalFolgesOpp ? 1 : 0;
    // Et punkt som ikke lenger skal følges opp har ingen frist å bomme på.
    if (!felter.skalFolgesOpp) rad.frist = null;
  }
  if (Object.keys(rad).length > 0) await oppdater("elevnotat", id, rad);
  varsleElever();
}

/** Lukker et oppfølgingspunkt, eller åpner det igjen. */
export async function settLukket(id: string, lukket: boolean): Promise<void> {
  await oppdater("elevnotat", id, {
    lukket: lukket ? new Date().toISOString().slice(0, 10) : null,
  });
  varsleElever();
}

export async function slettElevnotat(id: string): Promise<void> {
  await slett("elevnotat", id);
  varsleElever();
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

// ------------------------------------------------------------- øktnotater

/**
 * Notatet du skrev på eleven mens du skåret en økt (§4.4). Det bor på
 * skåringsraden, ikke i møteloggen — men det er like fullt noe du ville
 * huske om eleven, og står derfor i tidslinja på elevkortet.
 */
export type Oktnotat = {
  /** raden i oktnotat */
  id: string;
  oktId: string;
  dato: string;
  fagKode: string;
  tema: string | null;
  tekst: string;
  /** skalaverdiens fargenavn, til prikken i tidslinja; null når ikke skåret */
  farge: string | null;
  verdi: string | null;
};

export async function hentOktnotater(elevId: string): Promise<Oktnotat[]> {
  return hent<Oktnotat>(
    `SELECT n.id, o.id AS oktId, o.dato,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode,
            o.tema, n.tekst, sv.farge, sv.kode AS verdi
       FROM oktnotat n
       JOIN okt o          ON o.id = n.okt_id AND o.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
       JOIN fag f          ON f.id = sf.fag_id
       LEFT JOIN skaring s ON s.okt_id = o.id AND s.elev_id = n.elev_id
                          AND s.slettet IS NULL
       LEFT JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
      WHERE n.elev_id = $1 AND n.slettet IS NULL
        AND TRIM(n.tekst) <> ''
      ORDER BY o.dato DESC, o.klokkeslett DESC`,
    [elevId],
  );
}

export type Tidslinjepunkt =
  | { slag: "notat"; dato: string; notat: Elevnotat }
  | { slag: "okt"; dato: string; notat: Oktnotat };

export type Notatfilter = "alle" | "motelogg" | "okt";

/**
 * Møteloggen og øktnotatene i én tidslinje. Åpne oppfølgingspunkter står
 * øverst som før (§4.7); resten flettes etter dato, nyeste først.
 */
export function flettTidslinje(
  notater: Elevnotat[],
  oktnotater: Oktnotat[],
  filter: Notatfilter = "alle",
): Tidslinjepunkt[] {
  const sortert = sorterNotater(notater);
  const apent = (n: Elevnotat) => n.skalFolgesOpp && n.lukket === null;
  const topp: Tidslinjepunkt[] =
    filter === "okt"
      ? []
      : sortert
          .filter(apent)
          .map((n) => ({ slag: "notat" as const, dato: n.dato, notat: n }));
  const resten: Tidslinjepunkt[] = [
    ...(filter === "okt"
      ? []
      : sortert
          .filter((n) => !apent(n))
          .map((n) => ({ slag: "notat" as const, dato: n.dato, notat: n }))),
    ...(filter === "motelogg"
      ? []
      : oktnotater.map((n) => ({
          slag: "okt" as const,
          dato: n.dato,
          notat: n,
        }))),
  ];
  // Stabil sortering: samme dato beholder rekkefølgen over — møtelogg før økt.
  resten.sort((a, b) => b.dato.localeCompare(a.dato));
  return [...topp, ...resten];
}
