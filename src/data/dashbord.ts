import { hent } from "../db";
import { hentSamtaledager, timerPaDagen } from "./samtale";

/**
 * Tallene årsskjermen bygger på.
 *
 * Alle spørringene her filtrerer bort `teller_ikke = 1` — «ikke i økta» og
 * `IV`. De verdiene er fravær av grunnlag, ikke et dårlig resultat, og skal
 * aldri inngå i snitt eller sammenstilling. Filteret ligger her i
 * spørringslaget, ikke i visningen, slik at ingen ny graf kan glemme det.
 */

// --------------------------------------------------------------- innsats

export type Uketall = {
  /** ISO-uke som "2026-34", til gruppering og sortering */
  uke: string;
  /** Mandagen i uka, til aksemerking */
  forste: string;
  gronn: number;
  gul: number;
  rod: number;
};

/**
 * Skåringene per uke, fordelt på farge.
 *
 * Stolpehøyden er antall skåringer, ikke andel. Det er med vilje: en uke med
 * to skåringer og en uke med tretti sier ikke det samme om klassen, og en
 * andelsgraf ville skjult forskjellen.
 */
export async function hentInnsatsPerUke(
  skolearId: string,
  skolearFagId?: string | null,
): Promise<Uketall[]> {
  return hent<Uketall>(
    `SELECT strftime('%Y-%W', o.dato)                        AS uke,
            MIN(o.dato)                                      AS forste,
            SUM(CASE WHEN sv.farge = 'gronn' THEN 1 ELSE 0 END) AS gronn,
            SUM(CASE WHEN sv.farge = 'gul'   THEN 1 ELSE 0 END) AS gul,
            SUM(CASE WHEN sv.farge = 'rod'   THEN 1 ELSE 0 END) AS rod
       FROM skaring s
       JOIN okt o          ON o.id = s.okt_id AND o.slettet IS NULL
       JOIN skalaverdi sv  ON sv.id = s.skalaverdi_id
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
      WHERE s.slettet IS NULL
        AND sv.teller_ikke = 0
        AND sf.skolear_id = $1
        AND ($2 IS NULL OR sf.id = $2)
      GROUP BY uke
      ORDER BY uke`,
    [skolearId, skolearFagId ?? null],
  );
}

// ----------------------------------------------------------- timeregnskap

export type Fagtimer = {
  skolearFagId: string;
  kode: string;
  navn: string;
  farge: string | null;
  /** Årstimetallet læreren har lagt inn. null = ikke satt */
  arstimetall: number | null;
  planlagtMin: number;
  /** timer satt av til muntlige samtaler i faget (§4.10) */
  vurderingTimer: number;
  vurderingAntall: number;
  antallOkter: number;
  /** Hvor mange av øktene som er avholdt: datert i dag eller tidligere */
  avholdte: number;
};

/**
 * Timene som går med til samtaledager, per fag — og for mentorsamtalene, som
 * ikke hører til noe fag.
 *
 * Nøkkelen er `skolear_fag_id`, der null er mentorsamtalen. Timene regnes med
 * `timerPaDagen` framfor i SQL, så det er den samme regelen som ellers: spennet
 * minus lunsjen når dagen er lang nok til å nå den.
 */
export async function hentVurderingstimer(
  skolearId: string,
): Promise<Map<string | null, { timer: number; antall: number }>> {
  const dager = await hentSamtaledager(skolearId);
  const [ar] = await hent<{ start: string; slutt: string }>(
    "SELECT start, slutt FROM skolear WHERE id = $1",
    [skolearId],
  );

  const ut = new Map<string | null, { timer: number; antall: number }>();
  for (const d of dager) {
    // Samme regel som for øktene: en dag utenfor skoleårets spenn teller ikke.
    if (ar && (d.dato < ar.start || d.dato > ar.slutt)) continue;
    // En dag som ligger i en økt, er allerede talt som økt. Å telle den her
    // også ville gitt samme timer to ganger.
    if (d.oktId) continue;

    const na = ut.get(d.skolearFagId) ?? { timer: 0, antall: 0 };
    ut.set(d.skolearFagId, {
      timer: Math.round((na.timer + timerPaDagen(d)) * 10) / 10,
      antall: na.antall + d.antall,
    });
  }
  return ut;
}

/**
 * Planlagte timer mot årstimetall, per fag.
 *
 * «Avholdt» er datoen: en økt i dag eller tidligere er holdt, enten den er
 * skåret eller ikke. Det er ikke et felt, og skal ikke bli et.
 *
 * Bare økter som ligger innenfor skoleårets spenn teller. En økt datert før
 * skolestart eller etter skoleslutt vises fortsatt i kalenderen, men tonet
 * ned som «utenfor» — og da kan den ikke samtidig telle mot årstimetallet.
 * Ellers måles planen mot et timetall den ikke hører til.
 */
export async function hentTimeregnskap(
  skolearId: string,
  idag: string = new Date().toLocaleDateString("sv-SE"),
): Promise<Fagtimer[]> {
  const vurdering = await hentVurderingstimer(skolearId);
  const rader = await hent<
    Omit<Fagtimer, "vurderingTimer" | "vurderingAntall">
  >(
    `SELECT sf.id                                   AS skolearFagId,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS kode,
            f.navn                                  AS navn,
            f.farge                                 AS farge,
            sf.arstimetall                          AS arstimetall,
            COALESCE(SUM(o.varighet_min), 0)        AS planlagtMin,
            COUNT(o.id)                             AS antallOkter,
            COALESCE(SUM(
              CASE WHEN o.dato <= $2 THEN 1 ELSE 0 END), 0)
                                                    AS avholdte
       FROM skolear_fag sf
       JOIN fag f ON f.id = sf.fag_id
       JOIN skolear a ON a.id = sf.skolear_id
       LEFT JOIN okt o ON o.skolear_fag_id = sf.id AND o.slettet IS NULL
                      AND o.dato BETWEEN a.start AND a.slutt
      WHERE sf.slettet IS NULL AND sf.skolear_id = $1
      GROUP BY sf.id
      ORDER BY f.kode`,
    [skolearId, idag],
  );

  return rader.map((r) => ({
    ...r,
    vurderingTimer: vurdering.get(r.skolearFagId)?.timer ?? 0,
    vurderingAntall: vurdering.get(r.skolearFagId)?.antall ?? 0,
  }));
}

// ------------------------------------------------------------ elever som glipper

export type Glipp = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  klasse: string | null;
  /** Siste dato eleven ble skåret i år. null = aldri */
  siste: string | null;
  antall: number;
};

/**
 * Elevene med færrest skåringer, og hvor lenge siden sist.
 *
 * Poenget er å avsløre dem du har oversett, ikke dem som har vært borte —
 * derfor teller «ikke i økta» ikke med her heller. En elev du har registrert
 * som fraværende er sett; en elev uten rader er ikke det.
 */
export async function hentGlipp(
  skolearId: string,
  grense = 8,
): Promise<Glipp[]> {
  return hent<Glipp>(
    `SELECT e.id                       AS elevId,
            e.fornavn                  AS fornavn,
            e.etternavn                AS etternavn,
            k.navn                     AS klasse,
            MAX(o.dato)                AS siste,
            COUNT(s.id)                AS antall
       FROM elev e
       JOIN elev_fag ef    ON ef.elev_id = e.id AND ef.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       LEFT JOIN elev_klasse ek ON ek.elev_id = e.id
                          AND ek.skolear_id = $1 AND ek.slettet IS NULL
       LEFT JOIN klasse k  ON k.id = ek.klasse_id AND k.slettet IS NULL
       LEFT JOIN skaring s ON s.elev_id = e.id AND s.slettet IS NULL
       LEFT JOIN okt o     ON o.id = s.okt_id AND o.slettet IS NULL
                          AND o.skolear_fag_id = sf.id
       LEFT JOIN skalaverdi sv ON sv.id = s.skalaverdi_id AND sv.teller_ikke = 0
      WHERE e.slettet IS NULL AND (s.id IS NULL OR sv.id IS NOT NULL)
      GROUP BY e.id
      ORDER BY antall ASC, siste ASC
      LIMIT $2`,
    [skolearId, grense],
  );
}

// --------------------------------------------------------- kommende vurderinger

export type Kommende = {
  vurderingId: string;
  tittel: string;
  frist: string;
  kode: string;
  farge: string | null;
  /** Hvor mange elever som har fått et resultat */
  fort: number;
  elever: number;
};

/**
 * Vurderinger med frist, nærmeste først. Tar med dem som har passert og
 * ikke er ferdig ført — en glemt frist er nettopp det man vil se.
 */
export async function hentKommendeVurderinger(
  skolearId: string,
  grense = 6,
): Promise<Kommende[]> {
  return hent<Kommende>(
    `SELECT v.id     AS vurderingId,
            v.tittel AS tittel,
            v.frist  AS frist,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS kode,
            f.farge  AS farge,
            (SELECT COUNT(*) FROM vurderingsresultat vr
              WHERE vr.vurdering_id = v.id AND vr.slettet IS NULL
                AND vr.skalaverdi_id IS NOT NULL)        AS fort,
            (SELECT COUNT(*) FROM elev_fag ef
              WHERE ef.skolear_fag_id = v.skolear_fag_id
                AND ef.slettet IS NULL)                  AS elever
       FROM vurdering v
       JOIN skolear_fag sf ON sf.id = v.skolear_fag_id AND sf.slettet IS NULL
       JOIN fag f          ON f.id = sf.fag_id
      WHERE v.slettet IS NULL AND sf.skolear_id = $1 AND v.frist IS NOT NULL
      ORDER BY v.frist ASC
      LIMIT $2`,
    [skolearId, grense],
  );
}
