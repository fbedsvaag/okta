import { hent } from "../db";

/**
 * Alt om én elev, SPEC §4.5.
 *
 * Skjermen skal svare på ett spørsmål: hvordan har det gått med denne eleven
 * i år? Heatmapet er per økt, ikke per dato — én rute per økt i faget, uten
 * hull for dagene imellom. Da blir rutene like brede uansett om faget har
 * tre økter i uka eller én, og to fag kan sammenliknes.
 */

export type ElevGrunnlag = {
  id: string;
  kode: string | null;
  fornavn: string;
  etternavn: string;
  notat: string | null;
};

export type ElevAr = {
  skolearId: string;
  navn: string;
  klasse: string | null;
};

export type HeatmapRute = {
  oktId: string;
  dato: string;
  tema: string | null;
  /** null = ingen skåringsrad for denne eleven */
  verdiKode: string | null;
  verdiFarge: "gronn" | "gul" | "rod" | null;
  tellerIkke: number;
  notat: string | null;
  /** økta er avholdt hvis minst én elev er skåret */
  avholdt: number;
};

export type FagRad = {
  skolearFagId: string;
  fagKode: string;
  fagNavn: string;
  farge: string | null;
  ruter: HeatmapRute[];
};

export type ElevVurdering = {
  skolearFagId: string;
  fagKode: string;
  tittel: string;
  type: string | null;
  frist: string | null;
  resultat: string | null;
  levert: number;
  kommentar: string | null;
};

export async function hentElevGrunnlag(elevId: string): Promise<ElevGrunnlag | null> {
  const rader = await hent<ElevGrunnlag>(
    "SELECT id, kode, fornavn, etternavn, notat FROM elev WHERE id = $1 AND slettet IS NULL",
    [elevId],
  );
  return rader[0] ?? null;
}

/** Skoleårene eleven har vært i, nyeste først. Klassen kan mangle. */
export async function hentElevAr(elevId: string): Promise<ElevAr[]> {
  return hent<ElevAr>(
    `SELECT sa.id AS skolearId, sa.navn, k.navn AS klasse
       FROM skolear sa
       LEFT JOIN elev_klasse ek
              ON ek.skolear_id = sa.id AND ek.elev_id = $1 AND ek.slettet IS NULL
       LEFT JOIN klasse k ON k.id = ek.klasse_id AND k.slettet IS NULL
      WHERE sa.slettet IS NULL
        AND (ek.id IS NOT NULL
             OR EXISTS (SELECT 1 FROM elev_fag ef
                          JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                         WHERE ef.elev_id = $1 AND ef.slettet IS NULL
                           AND sf.slettet IS NULL AND sf.skolear_id = sa.id))
      ORDER BY sa.start DESC`,
    [elevId],
  );
}

export async function hentHeatmap(
  elevId: string,
  skolearId: string,
): Promise<FagRad[]> {
  const rader = await hent<
    HeatmapRute & { skolearFagId: string; fagKode: string; fagNavn: string; farge: string | null }
  >(
    `SELECT sf.id   AS skolearFagId,
            f.kode  AS fagKode,
            f.navn  AS fagNavn,
            f.farge AS farge,
            o.id    AS oktId,
            o.dato, o.tema,
            sv.kode        AS verdiKode,
            sv.farge       AS verdiFarge,
            COALESCE(sv.teller_ikke, 0) AS tellerIkke,
            s.notat,
            (SELECT COUNT(*) FROM skaring s2
              WHERE s2.okt_id = o.id AND s2.slettet IS NULL) AS avholdt
       FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $2
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
       JOIN okt o ON o.skolear_fag_id = sf.id AND o.slettet IS NULL
       LEFT JOIN skaring s
              ON s.okt_id = o.id AND s.elev_id = $1 AND s.slettet IS NULL
       LEFT JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
      WHERE ef.elev_id = $1 AND ef.slettet IS NULL
      ORDER BY f.kode, o.dato, o.klokkeslett IS NULL, o.klokkeslett`,
    [elevId, skolearId],
  );

  const perFag = new Map<string, FagRad>();
  for (const r of rader) {
    let fag = perFag.get(r.skolearFagId);
    if (!fag) {
      fag = {
        skolearFagId: r.skolearFagId,
        fagKode: r.fagKode,
        fagNavn: r.fagNavn,
        farge: r.farge,
        ruter: [],
      };
      perFag.set(r.skolearFagId, fag);
    }
    fag.ruter.push({
      oktId: r.oktId,
      dato: r.dato,
      tema: r.tema,
      verdiKode: r.verdiKode,
      verdiFarge: r.verdiFarge,
      tellerIkke: r.tellerIkke,
      notat: r.notat,
      avholdt: r.avholdt,
    });
  }

  return [...perFag.values()];
}

/** Fag eleven har i året, også de uten økter ennå. */
export async function hentElevFag(
  elevId: string,
  skolearId: string,
): Promise<{ skolearFagId: string; fagKode: string; fagNavn: string; farge: string | null }[]> {
  return hent(
    `SELECT sf.id AS skolearFagId, f.kode AS fagKode, f.navn AS fagNavn, f.farge
       FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $2
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
      WHERE ef.elev_id = $1 AND ef.slettet IS NULL
      ORDER BY f.kode`,
    [elevId, skolearId],
  );
}

export async function hentElevVurderinger(
  elevId: string,
  skolearId: string,
): Promise<ElevVurdering[]> {
  return hent<ElevVurdering>(
    `SELECT sf.id AS skolearFagId,
            f.kode AS fagKode,
            vu.tittel, vu.type, vu.frist,
            sv.kode AS resultat,
            COALESCE(r.levert, 0) AS levert,
            r.kommentar
       FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $2
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
       JOIN vurdering vu ON vu.skolear_fag_id = sf.id AND vu.slettet IS NULL
       LEFT JOIN vurderingsresultat r
              ON r.vurdering_id = vu.id AND r.elev_id = $1 AND r.slettet IS NULL
       LEFT JOIN skalaverdi sv ON sv.id = r.skalaverdi_id
      WHERE ef.elev_id = $1 AND ef.slettet IS NULL
      ORDER BY f.kode, vu.frist IS NULL, vu.frist`,
    [elevId, skolearId],
  );
}

