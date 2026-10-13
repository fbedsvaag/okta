import { hent } from "../db";
import { hentSamtaledager, timerPaDagen } from "./samtale";
import { glipper, hentOktrader, sisteRuter } from "./oktrader";

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
       -- Skåringer fra slettede elever teller ikke.
       JOIN elev e         ON e.id = s.elev_id AND e.slettet IS NULL
       JOIN okt o          ON o.id = s.okt_id AND o.slettet IS NULL
       -- Bare elever som står i faget nå, som i øktlista.
       JOIN elev_fag ef    ON ef.elev_id = s.elev_id
                          AND ef.skolear_fag_id = o.skolear_fag_id
                          AND ef.slettet IS NULL
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

/** Én uke i ett fag på innsatslinja. */
export type Innsatsprikk = {
  /** mandagen i uka, ISO */
  mandag: string;
  gronn: number;
  gul: number;
  rod: number;
};

export type Innsatslinje = {
  skolearFagId: string;
  kode: string;
  farge: string | null;
  prikker: Innsatsprikk[];
};

/**
 * Skåringene per fag og uke, til linjene på forsiden: én linje per fag, én
 * prikk per uke. Uker uten skåringer har ingen prikk — hullet er poenget.
 *
 * Grupperes per mandag i JavaScript framfor med strftime('%W'), som ikke er
 * ISO-uker og deler uka feil rundt nyttår.
 */
export async function hentInnsatslinjer(
  skolearId: string,
): Promise<Innsatslinje[]> {
  const rader = await hent<{
    skolearFagId: string;
    kode: string;
    farge: string | null;
    dato: string;
    gronn: number;
    gul: number;
    rod: number;
  }>(
    `SELECT sf.id AS skolearFagId,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS kode,
            f.farge,
            o.dato,
            SUM(CASE WHEN sv.farge = 'gronn' THEN 1 ELSE 0 END) AS gronn,
            SUM(CASE WHEN sv.farge = 'gul'   THEN 1 ELSE 0 END) AS gul,
            SUM(CASE WHEN sv.farge = 'rod'   THEN 1 ELSE 0 END) AS rod
       FROM skaring s
       JOIN elev e         ON e.id = s.elev_id AND e.slettet IS NULL
       JOIN okt o          ON o.id = s.okt_id AND o.slettet IS NULL
       -- Bare elever som står i faget nå, som i øktlista.
       JOIN elev_fag ef    ON ef.elev_id = s.elev_id
                          AND ef.skolear_fag_id = o.skolear_fag_id
                          AND ef.slettet IS NULL
       JOIN skalaverdi sv  ON sv.id = s.skalaverdi_id
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
       JOIN fag f          ON f.id = sf.fag_id
      WHERE s.slettet IS NULL AND sv.teller_ikke = 0 AND sf.skolear_id = $1
      GROUP BY sf.id, o.dato
      ORDER BY kode, o.dato`,
    [skolearId],
  );

  const perFag = new Map<string, Innsatslinje>();
  for (const r of rader) {
    const linje = perFag.get(r.skolearFagId) ?? {
      skolearFagId: r.skolearFagId,
      kode: r.kode,
      farge: r.farge,
      prikker: [],
    };
    perFag.set(r.skolearFagId, linje);
    const mandag = mandagFor(r.dato);
    const p = linje.prikker.find((x) => x.mandag === mandag);
    if (p) {
      p.gronn += r.gronn;
      p.gul += r.gul;
      p.rod += r.rod;
    } else {
      linje.prikker.push({ mandag, gronn: r.gronn, gul: r.gul, rod: r.rod });
    }
  }
  return [...perFag.values()];
}

/**
 * Uka samlet i ett av trafikklysets fem trinn: andelen grønt, der gult
 * teller halvt. Nesten alt grønt er grønn, mest rødt er rød.
 */
export function ukesfarge(
  p: Pick<Innsatsprikk, "gronn" | "gul" | "rod">,
): "gronn" | "gronngul" | "gul" | "oransje" | "rod" | null {
  const total = p.gronn + p.gul + p.rod;
  if (total === 0) return null;
  return snittfarge((p.gronn + p.gul / 2) / total);
}

/** Et snitt fra 0 til 1 som ett av trafikklysets fem trinn. */
export function snittfarge(
  andel: number,
): "gronn" | "gronngul" | "gul" | "oransje" | "rod" {
  if (andel >= 0.8) return "gronn";
  if (andel >= 0.6) return "gronngul";
  if (andel >= 0.4) return "gul";
  if (andel >= 0.2) return "oransje";
  return "rod";
}

export function mandagFor(dato: string): string {
  const [a, m, d] = dato.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
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
  /** Siste dato eleven ble skåret i år */
  siste: string;
  /** skåringer som teller med */
  antall: number;
  /** snittet, fra 0 (laveste verdi på skalaen) til 1 (høyeste) */
  snitt: number;
};

/**
 * Elevene som glipper, lavest snitt først.
 *
 * «Glipper» er samme regel som i Elever-lista: minst to røde blant de fem
 * siste øktene (`glipper` i oktrader.ts). Før sto de åtte med lavest snitt
 * her uansett nivå, så en sterk klasse fikk gode elever under «glipper».
 *
 * Hver skåring regnes om til et tall fra 0 til 1 etter hvor den ligger på
 * sin egen skala — rød er 0, grønn 1, gul midt imellom på trafikklyset. Da
 * kan fag med ulike skalaer stå i samme liste, uten at noen skala er
 * hardkodet. «Ikke i økta» (`teller_ikke`) er verken høyt eller lavt og
 * holdes utenfor, også når ytterpunktene på skalaen finnes.
 *
 * Bare skåringer i fag eleven fortsatt står i teller. En elev uten skåringer
 * har ikke noe snitt og står ikke her.
 */
export async function hentGlipp(
  skolearId: string,
  grense = 8,
): Promise<Glipp[]> {
  return hent<Glipp>(
    `WITH spenn AS (
       SELECT skala_id, MIN(rang) AS mn, MAX(rang) AS mx
         FROM skalaverdi WHERE teller_ikke = 0
        GROUP BY skala_id
     ),
     poeng AS (
       SELECT s.elev_id AS elevId, o.dato,
              CASE WHEN sp.mx = sp.mn THEN 1.0
                   ELSE (sv.rang - sp.mn) * 1.0 / (sp.mx - sp.mn) END AS p
         FROM skaring s
         JOIN okt o          ON o.id = s.okt_id AND o.slettet IS NULL
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                            AND sf.slettet IS NULL AND sf.skolear_id = $1
         JOIN elev_fag ef    ON ef.elev_id = s.elev_id
                            AND ef.skolear_fag_id = sf.id AND ef.slettet IS NULL
         JOIN skalaverdi sv  ON sv.id = s.skalaverdi_id AND sv.teller_ikke = 0
         JOIN spenn sp       ON sp.skala_id = sv.skala_id
        WHERE s.slettet IS NULL
     )
     SELECT e.id        AS elevId,
            e.fornavn   AS fornavn,
            e.etternavn AS etternavn,
            k.navn      AS klasse,
            MAX(p.dato) AS siste,
            COUNT(*)    AS antall,
            AVG(p.p)    AS snitt
       FROM poeng p
       JOIN elev e ON e.id = p.elevId AND e.slettet IS NULL
       LEFT JOIN elev_klasse ek ON ek.elev_id = e.id
                          AND ek.skolear_id = $1 AND ek.slettet IS NULL
       LEFT JOIN klasse k  ON k.id = ek.klasse_id AND k.slettet IS NULL
      GROUP BY e.id
      ORDER BY snitt ASC, antall DESC, e.etternavn, e.fornavn`,
    [skolearId],
  ).then(async (alle) => {
    const rader = await hentOktrader(skolearId);
    return alle
      .filter((e) => glipper(sisteRuter(rader, e.elevId)))
      .slice(0, grense);
  });
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
 * Vurderinger med frist som ikke er ferdig ført, nærmeste først. Med dem
 * som har passert: en glemt frist er nettopp det man vil se. En vurdering
 * der alle elevene har fått resultat, er ferdig og står ikke her; ellers
 * ville høstens vurderinger fylt lista resten av året.
 *
 * «Ført» og «elever» telles som i Vurderinger: elever som er slettet,
 * teller ikke.
 */
export async function hentKommendeVurderinger(
  skolearId: string,
  grense = 6,
): Promise<Kommende[]> {
  return hent<Kommende>(
    `WITH alle AS (
       SELECT v.id     AS vurderingId,
              v.tittel AS tittel,
              v.frist  AS frist,
              COALESCE(NULLIF(f.alias, ''), f.kode) AS kode,
              f.farge  AS farge,
              (SELECT COUNT(*) FROM vurderingsresultat vr
                WHERE vr.vurdering_id = v.id AND vr.slettet IS NULL
                  AND vr.skalaverdi_id IS NOT NULL)        AS fort,
              (SELECT COUNT(*) FROM elev_fag ef
                 JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
                WHERE ef.skolear_fag_id = v.skolear_fag_id
                  AND ef.slettet IS NULL)                  AS elever
         FROM vurdering v
         JOIN skolear_fag sf ON sf.id = v.skolear_fag_id AND sf.slettet IS NULL
         JOIN fag f          ON f.id = sf.fag_id
        WHERE v.slettet IS NULL AND sf.skolear_id = $1 AND v.frist IS NOT NULL
     )
     SELECT * FROM alle
      WHERE elever = 0 OR fort < elever
      ORDER BY frist ASC
      LIMIT $2`,
    [skolearId, grense],
  );
}
