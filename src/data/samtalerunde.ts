import { hent, idag, oppdater, settInn, slett } from "../db";
import { lesJson } from "./json";
import { varsleElever, varsleVurderinger } from "./endringer";

/**
 * Mentorsamtalene i ny stil (ARBEIDSLISTE 29.6): en runde har dager,
 * samtaleguide og tider. Per samtale: med foresatt, guiden krysset av,
 * notat (elevnotat med samtale-id), mål fra forrige gang og til neste.
 *
 * **Bare for læreren.** Ingenting her leses av eksport, utskrift, Teams,
 * kalender eller oppsettfila. Testene i personvern.test.ts holder det slik.
 */

export type Samtalerunde = {
  id: string;
  navn: string;
  guide: string[];
  samtaleMin: number | null;
  pauseMin: number | null;
};

export const STANDARD_GUIDE = [
  "Hvordan har du det på skolen nå?",
  "Hvordan er det i klassen? Hvem jobber du godt med?",
  "Hvilke fag går bra, og hvilke er tunge?",
  "Fravær og frister: noe vi må se på?",
  "Hva vil du jobbe med fram til neste samtale?",
];

export async function hentRunder(skolearId: string): Promise<Samtalerunde[]> {
  const rader = await hent<{
    id: string;
    navn: string;
    guide: string | null;
    samtaleMin: number | null;
    pauseMin: number | null;
  }>(
    `SELECT id, navn, guide, samtale_min AS samtaleMin, pause_min AS pauseMin
       FROM samtalerunde
      WHERE skolear_id = $1 AND slettet IS NULL
      ORDER BY opprettet`,
    [skolearId],
  );
  return rader.map((r) => ({
    ...r,
    guide: lesJson<string[]>(r.guide, STANDARD_GUIDE, "samtaleguiden"),
  }));
}

export async function opprettRunde(
  skolearId: string,
  navn: string,
): Promise<string> {
  const id = await settInn("samtalerunde", {
    skolear_id: skolearId,
    navn,
    guide: JSON.stringify(STANDARD_GUIDE),
    samtale_min: 20,
    pause_min: 5,
  });
  varsleVurderinger();
  return id;
}

export async function endreRunde(
  id: string,
  felter: Partial<Omit<Samtalerunde, "id">>,
): Promise<void> {
  const ut: Record<string, unknown> = {};
  if (felter.navn !== undefined) ut.navn = felter.navn;
  if (felter.guide !== undefined) ut.guide = JSON.stringify(felter.guide);
  if (felter.samtaleMin !== undefined) ut.samtale_min = felter.samtaleMin;
  if (felter.pauseMin !== undefined) ut.pause_min = felter.pauseMin;
  await oppdater("samtalerunde", id, ut);
  varsleVurderinger();
}

export async function slettRunde(id: string): Promise<void> {
  const dager = await hent<{ id: string }>(
    "SELECT id FROM samtaledag WHERE samtalerunde_id = $1 AND slettet IS NULL",
    [id],
  );
  for (const d of dager) {
    const s = await hent<{ id: string }>(
      "SELECT id FROM samtale WHERE samtaledag_id = $1 AND slettet IS NULL",
      [d.id],
    );
    for (const x of s) await slett("samtale", x.id);
    await slett("samtaledag", d.id);
  }
  await slett("samtalerunde", id);
  varsleVurderinger();
}

/** «Mentorsamtaler høst» eller «… vår», etter måneden. */
export function rundenavn(dato: string, ord: string): string {
  const m = Number(dato.slice(5, 7));
  return `${ord} ${m >= 8 ? "høst" : "vår"}`;
}

/** Mentorelevene i skoleåret. */
export async function hentMentorelever(
  skolearId: string,
): Promise<{ elevId: string; fornavn: string; etternavn: string }[]> {
  return hent(
    `SELECT DISTINCT e.id AS elevId, e.fornavn, e.etternavn
       FROM elev_klasse ek
       JOIN elev e ON e.id = ek.elev_id AND e.slettet IS NULL
      WHERE ek.skolear_id = $1 AND ek.mentor = 1 AND ek.slettet IS NULL
      ORDER BY e.fornavn, e.etternavn`,
    [skolearId],
  );
}

// ------------------------------------------------------------ per samtale

export type Samtaledetaljer = {
  medForesatt: boolean;
  guideStilt: number[];
};

export async function hentDetaljer(
  samtaleIder: string[],
): Promise<Map<string, Samtaledetaljer>> {
  if (samtaleIder.length === 0) return new Map();
  const plass = samtaleIder.map((_, i) => `$${i + 1}`).join(", ");
  const rader = await hent<{
    id: string;
    medForesatt: number;
    guideStilt: string | null;
  }>(
    `SELECT id, med_foresatt AS medForesatt, guide_stilt AS guideStilt
       FROM samtale WHERE id IN (${plass})`,
    samtaleIder,
  );
  return new Map(
    rader.map((r) => [
      r.id,
      {
        medForesatt: r.medForesatt === 1,
        guideStilt: lesJson<number[]>(r.guideStilt, [], "guiden"),
      },
    ]),
  );
}

export async function settForesatt(
  samtaleId: string,
  med: boolean,
): Promise<void> {
  await oppdater("samtale", samtaleId, { med_foresatt: med ? 1 : 0 });
}

export async function settGuideStilt(
  samtaleId: string,
  stilt: number[],
): Promise<void> {
  await oppdater("samtale", samtaleId, { guide_stilt: JSON.stringify(stilt) });
}

/** Notatet fra samtalen: elevnotatet med samtalens id, eller null. */
export async function hentSamtalensNotat(
  samtaleId: string,
): Promise<{ id: string; tekst: string } | null> {
  const [n] = await hent<{ id: string; tekst: string }>(
    `SELECT id, tekst FROM elevnotat
      WHERE samtale_id = $1 AND slettet IS NULL
      ORDER BY opprettet DESC LIMIT 1`,
    [samtaleId],
  );
  return n ?? null;
}

// ------------------------------------------------------------------- mål

export type Samtalemal = {
  id: string;
  elevId: string;
  samtaleId: string | null;
  tekst: string;
  /** datoen målet ble nådd, eller null */
  nadd: string | null;
  /** datoen samtalen var, når målet ble satt i en */
  dato: string | null;
};

export async function hentMal(elevId: string): Promise<Samtalemal[]> {
  return hent<Samtalemal>(
    `SELECT m.id, m.elev_id AS elevId, m.samtale_id AS samtaleId, m.tekst,
            m.nadd, d.dato
       FROM samtalemal m
       LEFT JOIN samtale s ON s.id = m.samtale_id
       LEFT JOIN samtaledag d ON d.id = s.samtaledag_id
      WHERE m.elev_id = $1 AND m.slettet IS NULL
      ORDER BY m.opprettet`,
    [elevId],
  );
}

/**
 * Målene fra forrige samtale og til neste: de som ble satt i denne
 * samtalen, står under «til neste gang»; de som ble satt før og ikke er
 * nådd (eller ble nådd siden), under «fra forrige».
 */
export function delMal(
  mal: Samtalemal[],
  samtaleId: string,
): { fraForrige: Samtalemal[]; tilNeste: Samtalemal[] } {
  return {
    tilNeste: mal.filter((m) => m.samtaleId === samtaleId),
    fraForrige: mal.filter((m) => m.samtaleId !== samtaleId),
  };
}

export async function leggTilMal(
  elevId: string,
  samtaleId: string | null,
  tekst: string,
): Promise<string> {
  const id = await settInn("samtalemal", {
    elev_id: elevId,
    samtale_id: samtaleId,
    tekst,
    nadd: null,
  });
  varsleElever();
  return id;
}

export async function settNadd(id: string, nadd: boolean): Promise<void> {
  await oppdater("samtalemal", id, { nadd: nadd ? idag() : null });
  varsleElever();
}

export async function slettMal(id: string): Promise<void> {
  await slett("samtalemal", id);
  varsleElever();
}

/** Mål som ikke er nådd, for Følg opp (29.7). */
export async function hentApneMal(): Promise<Samtalemal[]> {
  return hent<Samtalemal>(
    `SELECT m.id, m.elev_id AS elevId, m.samtale_id AS samtaleId, m.tekst,
            m.nadd, d.dato
       FROM samtalemal m
       JOIN elev e ON e.id = m.elev_id AND e.slettet IS NULL
       LEFT JOIN samtale s ON s.id = m.samtale_id
       LEFT JOIN samtaledag d ON d.id = s.samtaledag_id
      WHERE m.slettet IS NULL AND m.nadd IS NULL
      ORDER BY m.opprettet`,
  );
}

// -------------------------------------------------------------- oversikt

export type Elevoversikt = {
  /** økter eleven var borte i, i dine fag i år */
  fravaer: number;
  /** innsatsen de siste fire øktene per fag */
  innsats: { fagKode: string; farger: (string | null)[] }[];
  /** innleveringer og prøver med «ikke levert» */
  ikkeLevert: number;
};

/** Den lille oversikten i samtalen: fravær, innsats og frister. */
export async function hentElevoversikt(
  elevId: string,
  skolearId: string,
): Promise<Elevoversikt> {
  const [[f], skar, [l]] = await Promise.all([
    hent<{ n: number }>(
      `SELECT COUNT(*) AS n FROM skaring s
         JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
         JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
        WHERE s.elev_id = $1 AND sf.skolear_id = $2 AND s.slettet IS NULL
          AND sv.teller_ikke = 1`,
      [elevId, skolearId],
    ),
    hent<{ fagKode: string; farge: string | null; n: number }>(
      `SELECT fagKode, farge, n FROM (
         SELECT COALESCE(NULLIF(fa.alias, ''), fa.kode) AS fagKode,
                sv.farge,
                ROW_NUMBER() OVER (PARTITION BY o.skolear_fag_id
                                   ORDER BY o.dato DESC, o.klokkeslett DESC) AS n
           FROM skaring s
           JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
           JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
           JOIN fag fa ON fa.id = sf.fag_id
           JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
          WHERE s.elev_id = $1 AND sf.skolear_id = $2 AND s.slettet IS NULL
            AND sv.teller_ikke = 0)
        WHERE n <= 4 ORDER BY fagKode, n DESC`,
      [elevId, skolearId],
    ),
    hent<{ n: number }>(
      `SELECT COUNT(*) AS n FROM vurderingsresultat r
         JOIN vurdering v ON v.id = r.vurdering_id AND v.slettet IS NULL
         JOIN skolear_fag sf ON sf.id = v.skolear_fag_id AND sf.slettet IS NULL
        WHERE r.elev_id = $1 AND sf.skolear_id = $2 AND r.slettet IS NULL
          AND r.leveranse = 'ikke'`,
      [elevId, skolearId],
    ),
  ]);
  const perFag = new Map<string, (string | null)[]>();
  for (const s of skar)
    perFag.set(s.fagKode, [...(perFag.get(s.fagKode) ?? []), s.farge]);
  return {
    fravaer: f?.n ?? 0,
    innsats: [...perFag].map(([fagKode, farger]) => ({ fagKode, farger })),
    ikkeLevert: l?.n ?? 0,
  };
}
