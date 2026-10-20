import { hent } from "../db";

/**
 * Tallene og listene fagportalen viser. Alt regnes i spørringslaget, og
 * verdier med teller_ikke = 1 holdes utenfor overalt (§12).
 */

export type FagNokkeltall = {
  okter: number;
  avholdte: number;
  minutter: number;
  elever: number;
  vurderinger: number;
};

export type FagElev = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  kode: string | null;
  klasse: string | null;
  gronn: number;
  gul: number;
  rod: number;
  /** skåringer som teller — grunnlaget for de tre over */
  talt: number;
};

export type FagVurdering = {
  id: string;
  tittel: string;
  type: string | null;
  frist: string | null;
  fort: number;
};

export async function hentNokkeltall(
  skolearFagId: string,
  idag: string = new Date().toLocaleDateString("sv-SE"),
): Promise<FagNokkeltall> {
  // `innenfor` er øktene som ligger i skoleårets eget spenn. Økter datert før
  // skolestart eller etter skoleslutt vises i kalenderen, men tonet ned som
  // «utenfor» — og skal da ikke telle i fagets tall heller.
  const rader = await hent<FagNokkeltall>(
    `WITH innenfor AS (
       SELECT o.id, MIN(o.varighet_min, COALESCE(sf.tellende_min, o.varighet_min)) AS varighet_min, o.dato
         FROM okt o
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
         JOIN skolear a ON a.id = sf.skolear_id
        WHERE o.skolear_fag_id = $1 AND o.slettet IS NULL
          AND o.dato BETWEEN a.start AND a.slutt
     )
     SELECT
       (SELECT COUNT(*) FROM innenfor) AS okter,
       -- Avholdt er datoen, ikke skåringen: en økt som har vært, er holdt.
       (SELECT COUNT(*) FROM innenfor o WHERE o.dato <= $2) AS avholdte,
       (SELECT COALESCE(SUM(o.varighet_min), 0) FROM innenfor o) AS minutter,
       (SELECT COUNT(*) FROM elev_fag ef
          JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
         WHERE ef.skolear_fag_id = $1 AND ef.slettet IS NULL) AS elever,
       (SELECT COUNT(*) FROM vurdering v
         WHERE v.skolear_fag_id = $1 AND v.slettet IS NULL) AS vurderinger`,
    [skolearFagId, idag],
  );
  return rader[0];
}

export async function hentFagElever(
  skolearFagId: string,
  skolearId: string,
): Promise<FagElev[]> {
  return hent<FagElev>(
    `SELECT e.id AS elevId, e.fornavn, e.etternavn, e.kode,
            k.navn AS klasse,
            COALESCE(SUM(CASE WHEN sv.farge = 'gronn' THEN 1 ELSE 0 END), 0) AS gronn,
            COALESCE(SUM(CASE WHEN sv.farge = 'gul'   THEN 1 ELSE 0 END), 0) AS gul,
            COALESCE(SUM(CASE WHEN sv.farge = 'rod'   THEN 1 ELSE 0 END), 0) AS rod,
            COALESCE(COUNT(sv.id), 0) AS talt
       FROM elev_fag ef
       JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
       LEFT JOIN elev_klasse ek
              ON ek.elev_id = e.id AND ek.skolear_id = $2 AND ek.slettet IS NULL
       LEFT JOIN klasse k ON k.id = ek.klasse_id AND k.slettet IS NULL
       LEFT JOIN okt o ON o.skolear_fag_id = ef.skolear_fag_id AND o.slettet IS NULL
       LEFT JOIN skaring s
              ON s.okt_id = o.id AND s.elev_id = e.id AND s.slettet IS NULL
       LEFT JOIN skalaverdi sv
              ON sv.id = s.skalaverdi_id AND sv.teller_ikke = 0
      WHERE ef.skolear_fag_id = $1 AND ef.slettet IS NULL
      GROUP BY e.id
      ORDER BY e.fornavn COLLATE NOCASE, e.etternavn COLLATE NOCASE`,
    [skolearFagId, skolearId],
  );
}

export async function hentFagVurderinger(
  skolearFagId: string,
): Promise<FagVurdering[]> {
  return hent<FagVurdering>(
    `SELECT v.id, v.tittel, v.type, v.frist,
            (SELECT COUNT(*) FROM vurderingsresultat r
              WHERE r.vurdering_id = v.id AND r.slettet IS NULL
                AND r.skalaverdi_id IS NOT NULL) AS fort
       FROM vurdering v
      WHERE v.skolear_fag_id = $1 AND v.slettet IS NULL
      ORDER BY v.frist IS NULL, v.frist`,
    [skolearFagId],
  );
}

// ------------------------------------------------------------- øktloggen

export type Fagslogg = {
  oktId: string;
  dato: string;
  klokkeslett: string | null;
  tema: string | null;
  logg: string;
  /** skåringene som teller i økta, til prikken i tidslinja */
  gronn: number;
  gul: number;
  rod: number;
};

/**
 * Øktloggene i ett fag ett år, nyeste først. Bare økter med logg — det er
 * loggen som er historikken.
 *
 * `fagId` er faget i fagbanken, så samme fag kan vises for et annet år.
 */
export async function hentFagslogg(
  fagId: string,
  skolearId: string,
): Promise<Fagslogg[]> {
  return hent<Fagslogg>(
    `SELECT o.id AS oktId, o.dato, o.klokkeslett, o.tema, o.logg,
            COALESCE(SUM(CASE WHEN sv.farge = 'gronn' THEN 1 ELSE 0 END), 0) AS gronn,
            COALESCE(SUM(CASE WHEN sv.farge = 'gul'   THEN 1 ELSE 0 END), 0) AS gul,
            COALESCE(SUM(CASE WHEN sv.farge = 'rod'   THEN 1 ELSE 0 END), 0) AS rod
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
                          AND sf.fag_id = $1 AND sf.skolear_id = $2
       LEFT JOIN skaring s ON s.okt_id = o.id AND s.slettet IS NULL
       LEFT JOIN elev e    ON e.id = s.elev_id AND e.slettet IS NULL
       -- «Ikke i økta» teller ikke (teller_ikke, CLAUDE.md regel 5).
       LEFT JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
                              AND sv.teller_ikke = 0 AND e.id IS NOT NULL
      WHERE o.slettet IS NULL AND TRIM(COALESCE(o.logg, '')) <> ''
      GROUP BY o.id
      ORDER BY o.dato DESC, o.klokkeslett DESC`,
    [fagId, skolearId],
  );
}

/** Skoleårene faget har vært undervist, nyeste først. */
export async function hentArForFag(
  fagId: string,
): Promise<{ skolearId: string; navn: string }[]> {
  return hent(
    `SELECT s.id AS skolearId, s.navn
       FROM skolear_fag sf
       JOIN skolear s ON s.id = sf.skolear_id AND s.slettet IS NULL
      WHERE sf.fag_id = $1 AND sf.slettet IS NULL
      ORDER BY s.start DESC`,
    [fagId],
  );
}
