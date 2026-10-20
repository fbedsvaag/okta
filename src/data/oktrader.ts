import { hent } from "../db";

/**
 * Hver elev i hver avholdte økt i fagene hen har — grunnlaget for
 * «innsats, siste 10» og fraværet i Elever-lista, på fagsiden og i
 * elevkortet (ARBEIDSLISTE 11.1, 11.2, 11.7).
 *
 * En økt er avholdt når minst én elev er skåret (SPEC §3.3), og da står
 * hver elev i faget med en rad: verdien som ble satt, eller ingen verdi for
 * dem som ikke ble trykket på. Ikke skåret betyr til stede, ikke sett
 * (ARBEIDSLISTE 19.4): det er aldri fravær og teller ikke i innsatsen. Bare
 * «ikke i økta» (teller_ikke) er fravær. Elever som ble lagt i faget etter
 * økta, er ikke med: de var ikke i faget da. Står det en skåring på dem
 * likevel, teller den.
 *
 * Bare økter innenfor skoleårets spenn er med, som i timeregnskapet (§4.2).
 */
export type Oktrad = {
  elevId: string;
  skolearFagId: string;
  oktId: string;
  dato: string;
  klokkeslett: string | null;
  varighetMin: number;
  tema: string | null;
  /** skalaverdiens farge (gronn | gul | rod), null uten farge eller uten skåring */
  farge: string | null;
  /** 1 = «ikke i økta»: fravær, og teller ikke i noen sammenstilling */
  borte: number;
  /** 1 = ikke skåret: til stede, ikke sett. Verken fravær eller innsats. */
  ikkeSett: number;
};

export async function hentOktrader(skolearId: string): Promise<Oktrad[]> {
  return hent<Oktrad>(
    `WITH avholdt AS (
       SELECT o.id, o.skolear_fag_id, o.dato, o.klokkeslett, o.varighet_min,
              o.tema
         FROM okt o
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                            AND sf.slettet IS NULL AND sf.skolear_id = $1
         JOIN skolear sa     ON sa.id = sf.skolear_id
        WHERE o.slettet IS NULL
          AND o.dato BETWEEN sa.start AND sa.slutt
          AND EXISTS (SELECT 1 FROM skaring s
                       WHERE s.okt_id = o.id AND s.slettet IS NULL)
     )
     SELECT ef.elev_id        AS elevId,
            a.skolear_fag_id  AS skolearFagId,
            a.id              AS oktId,
            a.dato            AS dato,
            a.klokkeslett     AS klokkeslett,
            a.varighet_min    AS varighetMin,
            a.tema            AS tema,
            sv.farge          AS farge,
            CASE WHEN sv.teller_ikke = 1 THEN 1 ELSE 0 END
                              AS borte,
            CASE WHEN sv.id IS NULL THEN 1 ELSE 0 END
                              AS ikkeSett
       FROM avholdt a
       JOIN elev_fag ef   ON ef.skolear_fag_id = a.skolear_fag_id
                         AND ef.slettet IS NULL
       JOIN elev e        ON e.id = ef.elev_id AND e.slettet IS NULL
       LEFT JOIN skaring s ON s.okt_id = a.id AND s.elev_id = ef.elev_id
                          AND s.slettet IS NULL
       LEFT JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
      WHERE s.id IS NOT NULL OR a.dato >= substr(ef.opprettet, 1, 10)
      ORDER BY a.dato, a.klokkeslett`,
    [skolearId],
  );
}

// ------------------------------------------------------------------ innsats

/**
 * Én rute i «innsats, siste n»: g y r = trafikklyset, o = ikke i økta,
 * n = verdi uten farge, t = ikke skåret (tom rute).
 */
export type Rute = "g" | "y" | "r" | "o" | "n" | "t";

export function rute(r: Oktrad): Rute {
  if (r.borte) return "o";
  if (r.ikkeSett) return "t";
  return r.farge === "gronn"
    ? "g"
    : r.farge === "gul"
      ? "y"
      : r.farge === "rod"
        ? "r"
        : "n";
}

/**
 * De siste n øktene til eleven, eldst først, som ruter. Med fag: bare de
 * fagene. «Ikke i økta» er med som grå rute — den er et hull, ikke rød.
 */
export function sisteRuter(
  rader: Oktrad[],
  elevId: string,
  fag: ReadonlySet<string> | null = null,
  n = 10,
): Rute[] {
  return rader
    .filter((r) => r.elevId === elevId && (!fag || fag.has(r.skolearFagId)))
    .slice(-n)
    .map(rute);
}

/**
 * Snittet av rutene, fra 0 (rød) til 1 (grønn). «Ikke i økta» og verdier
 * uten farge teller ikke (CLAUDE.md regel 5). null uten noe å regne av.
 */
export function snitt(ruter: Rute[]): number | null {
  const tall = ruter.flatMap((r) =>
    r === "g" ? [1] : r === "y" ? [0.5] : r === "r" ? [0] : [],
  );
  return tall.length ? tall.reduce((a, b) => a + b, 0) / tall.length : null;
}

/**
 * Glipper: minst to røde blant de fem siste øktene (lerretet «Elever»).
 * Grått teller ikke — fravær er ikke lav innsats.
 */
export function glipper(ruter: Rute[]): boolean {
  return ruter.slice(-5).filter((r) => r === "r").length >= 2;
}

// ------------------------------------------------------------------- fravær

export type Fagfravaer = {
  skolearFagId: string;
  /** avholdte økter eleven var i faget */
  okter: number;
  /** av dem: «ikke i økta» */
  borte: number;
  /** minutter eleven var borte */
  borteMin: number;
  /** minuttene grensen regnes av: fagets årstimetall, se `fravaer` */
  grunnlagMin: number | null;
  /** borteMin / grunnlagMin, 0–1; null uten grunnlag */
  andel: number | null;
};

/** 10 % av timene i faget (opplæringsloven / forskrift § 3-3). */
export const GRENSE = 0.1;

/**
 * Fraværet til én elev, per fag, i timer mot fagets årstimetall
 * (ARBEIDSLISTE 11.7). 140 t gir en grense på 14 t.
 *
 * Har faget ikke årstimetall, regnes det av timene som er planlagt i
 * faget i skoleåret — det er det nærmeste appen vet om. Har faget heller
 * ingen planlagte timer, er det ingen prosent å regne.
 *
 * Appen skiller ikke dokumentert fra udokumentert fravær, og vet ikke om
 * timer eleven var borte fra uten at det ble skåret. InSchool er fasit.
 */
export function fravaer(
  rader: Oktrad[],
  elevId: string,
  grunnlag: ReadonlyMap<string, number | null>,
): Fagfravaer[] {
  const perFag = new Map<string, Fagfravaer>();
  for (const r of rader) {
    if (r.elevId !== elevId) continue;
    let f = perFag.get(r.skolearFagId);
    if (!f) {
      const g = grunnlag.get(r.skolearFagId) ?? null;
      f = {
        skolearFagId: r.skolearFagId,
        okter: 0,
        borte: 0,
        borteMin: 0,
        grunnlagMin: g && g > 0 ? g : null,
        andel: null,
      };
      perFag.set(r.skolearFagId, f);
    }
    f.okter++;
    if (r.borte) {
      f.borte++;
      f.borteMin += r.varighetMin;
    }
  }
  for (const f of perFag.values())
    f.andel = f.grunnlagMin ? f.borteMin / f.grunnlagMin : null;
  return [...perFag.values()];
}

/** Faget med høyest andel — det Elever-lista viser. */
export function hoyesteFravaer(f: Fagfravaer[]): Fagfravaer | null {
  let best: Fagfravaer | null = null;
  for (const x of f)
    if (x.andel !== null && (best === null || x.andel > (best.andel ?? -1)))
      best = x;
  return best;
}

/** Merket på fraværet: «Halvveis», «Nær grensen», «Over grensen». */
export function fravaersmerke(
  andel: number | null,
): { tekst: string; niva: "gul" | "rod" } | null {
  if (andel === null) return null;
  const avGrensen = andel / GRENSE;
  if (avGrensen > 1) return { tekst: "Over grensen", niva: "rod" };
  if (avGrensen >= 0.75) return { tekst: "Nær grensen", niva: "gul" };
  if (avGrensen >= 0.5) return { tekst: "Halvveis", niva: "gul" };
  return null;
}

/**
 * Minuttene grensen regnes av, per fag: årstimetallet, ellers timene som er
 * planlagt i skoleåret.
 */
export async function hentFravaersgrunnlag(
  skolearId: string,
): Promise<Map<string, number | null>> {
  const rader = await hent<{
    id: string;
    arstimetall: number | null;
    planlagt: number | null;
  }>(
    `SELECT sf.id AS id, sf.arstimetall AS arstimetall,
            (SELECT SUM(MIN(o.varighet_min, COALESCE(sf.tellende_min, o.varighet_min))) FROM okt o
              WHERE o.skolear_fag_id = sf.id AND o.slettet IS NULL
                AND o.dato BETWEEN sa.start AND sa.slutt) AS planlagt
       FROM skolear_fag sf
       JOIN skolear sa ON sa.id = sf.skolear_id
      WHERE sf.skolear_id = $1 AND sf.slettet IS NULL`,
    [skolearId],
  );
  return new Map(
    rader.map((r) => [
      r.id,
      r.arstimetall ? r.arstimetall * 60 : (r.planlagt ?? null),
    ]),
  );
}

// ------------------------------------------------------------------ visning

/** «15,8 t» — én desimal, norsk komma, uten «,0». */
export function timer(min: number): string {
  const t = Math.round((min / 60) * 10) / 10;
  return `${String(t).replace(".", ",")} t`;
}

/** «11 %», og «0,5 %» under én prosent så det ikke ser ut som null. */
export function prosent(andel: number): string {
  const p = andel * 100;
  if (p > 0 && p < 1)
    return `${String(Math.round(p * 10) / 10).replace(".", ",")} %`;
  return `${Math.round(p)} %`;
}
