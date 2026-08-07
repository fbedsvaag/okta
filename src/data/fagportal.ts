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
): Promise<FagNokkeltall> {
  const rader = await hent<FagNokkeltall>(
    `SELECT
       (SELECT COUNT(*) FROM okt o
         WHERE o.skolear_fag_id = $1 AND o.slettet IS NULL) AS okter,
       (SELECT COUNT(*) FROM okt o
         WHERE o.skolear_fag_id = $1 AND o.slettet IS NULL
           AND EXISTS (SELECT 1 FROM skaring s
                        WHERE s.okt_id = o.id AND s.slettet IS NULL)) AS avholdte,
       (SELECT COALESCE(SUM(o.varighet_min), 0) FROM okt o
         WHERE o.skolear_fag_id = $1 AND o.slettet IS NULL) AS minutter,
       (SELECT COUNT(*) FROM elev_fag ef
          JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
         WHERE ef.skolear_fag_id = $1 AND ef.slettet IS NULL) AS elever,
       (SELECT COUNT(*) FROM vurdering v
         WHERE v.skolear_fag_id = $1 AND v.slettet IS NULL) AS vurderinger`,
    [skolearFagId],
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
