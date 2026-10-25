import { hent, oppdater, settInnEllerOppdater } from "../db";
import { lesJson } from "./json";
import { varsleVurderinger } from "./endringer";
import type { Leveranse, Rubrikkvalg } from "./muntlig";

/**
 * Karakterer i faget (ARBEIDSLISTE 29.4, lerretet Karakterer): alle elever
 * × vurderinger, vekting per vurdering, beregnet vektet snitt, halvårs-
 * karakter og kommentar per termin. Verdier som ikke teller (IV), er holdt
 * utenfor snittet (CLAUDE.md regel 5).
 */

export type Termin = "host" | "var" | "aar";

export type Karaktervurdering = {
  id: string;
  tittel: string;
  type: string | null;
  dato: string | null;
  skalaNavn: string;
  /** satt for hånd, eller null = standard */
  vektSatt: number | null;
  /** skalaen har tallkarakterer */
  tall: boolean;
  rubrikk: string | null;
};

export type Karakterresultat = {
  vurderingId: string;
  elevId: string;
  kode: string | null;
  /** tallverdien, når koden er en tallkarakter som teller */
  tall: number | null;
  tellerIkke: boolean;
  kommentar: string | null;
  rubrikkvalg: Rubrikkvalg;
  leveranse: Leveranse | null;
};

export type Halvar = { karakter: string | null; kommentar: string | null };

export type Karakterdata = {
  vurderinger: Karaktervurdering[];
  elever: { elevId: string; fornavn: string; etternavn: string }[];
  /** `${vurderingId}:${elevId}` → resultatet */
  resultater: Map<string, Karakterresultat>;
  /** elev → fargene på de siste ti øktene, eldste først */
  innsats: Map<string, (string | null)[]>;
  /** `${termin}:${elevId}` → halvårskarakter og kommentar */
  halvar: Map<string, Halvar>;
};

/** Vekten som gjelder: satt for hånd, ellers 1 for tall og 0 ellers. */
export const vektFor = (v: Pick<Karaktervurdering, "vektSatt" | "tall">) =>
  v.vektSatt ?? (v.tall ? 1 : 0);

/**
 * Hvilke vurderinger som hører til terminen. Høsten går til nyttår i
 * skoleårets andre år; våren derfra. Vurderinger uten dato står i alle.
 */
export function iTermin(
  dato: string | null,
  termin: Termin,
  skolearSlutt: string,
): boolean {
  if (!dato || termin === "aar") return true;
  const skille = `${skolearSlutt.slice(0, 4)}-01-01`;
  return termin === "host" ? dato < skille : dato >= skille;
}

/** Det vektede snittet for en elev, eller null når ingenting teller. */
export function vektetSnitt(
  elevId: string,
  vurderinger: Karaktervurdering[],
  resultater: Map<string, Karakterresultat>,
): number | null {
  let sum = 0;
  let vekt = 0;
  for (const v of vurderinger) {
    const w = vektFor(v);
    const r = resultater.get(`${v.id}:${elevId}`);
    if (!w || !r || r.tall === null || r.tellerIkke) continue;
    sum += r.tall * w;
    vekt += w;
  }
  return vekt > 0 ? sum / vekt : null;
}

/** «4,3» */
export const somDesimal = (x: number | null) =>
  x === null ? "–" : x.toFixed(1).replace(".", ",");

const TALL = /^[1-6]([+-]|$)/;

export async function hentKarakterdata(
  skolearFagId: string,
): Promise<Karakterdata> {
  const [vurderinger, elever, resultater, innsats, halvar] = await Promise.all([
    hent<Omit<Karaktervurdering, "tall"> & { tall: number }>(
      `SELECT v.id, v.tittel, v.type,
                COALESCE((SELECT MIN(o.dato) FROM vurdering_okt vo
                            JOIN okt o ON o.id = vo.okt_id AND o.slettet IS NULL
                           WHERE vo.vurdering_id = v.id AND vo.slettet IS NULL),
                         v.frist) AS dato,
                sk.navn AS skalaNavn, v.vekt AS vektSatt, v.rubrikk,
                EXISTS (SELECT 1 FROM skalaverdi sv
                         WHERE sv.skala_id = v.skala_id AND sv.slettet IS NULL
                           AND sv.teller_ikke = 0 AND sv.kode GLOB '[1-6]*')
                  AS tall
           FROM vurdering v
           JOIN skala sk ON sk.id = v.skala_id
          WHERE v.skolear_fag_id = $1 AND v.slettet IS NULL AND v.utkast = 0
          ORDER BY dato IS NULL, dato, v.tittel`,
      [skolearFagId],
    ),
    hent<{ elevId: string; fornavn: string; etternavn: string }>(
      `SELECT e.id AS elevId, e.fornavn, e.etternavn
           FROM elev_fag ef
           JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
          WHERE ef.skolear_fag_id = $1 AND ef.slettet IS NULL
          ORDER BY e.fornavn, e.etternavn`,
      [skolearFagId],
    ),
    hent<{
      vurderingId: string;
      elevId: string;
      kode: string | null;
      tellerIkke: number | null;
      kommentar: string | null;
      rubrikkvalg: string | null;
      leveranse: Leveranse | null;
    }>(
      `SELECT r.vurdering_id AS vurderingId, r.elev_id AS elevId,
                sv.kode, sv.teller_ikke AS tellerIkke, r.kommentar,
                r.rubrikkvalg, r.leveranse
           FROM vurderingsresultat r
           JOIN vurdering v ON v.id = r.vurdering_id AND v.slettet IS NULL
           LEFT JOIN skalaverdi sv ON sv.id = r.skalaverdi_id
          WHERE v.skolear_fag_id = $1 AND r.slettet IS NULL`,
      [skolearFagId],
    ),
    hent<{ elevId: string; farge: string | null }>(
      `SELECT elevId, farge FROM (
           SELECT s.elev_id AS elevId, sv.farge, o.dato, o.klokkeslett,
                  ROW_NUMBER() OVER (PARTITION BY s.elev_id
                                     ORDER BY o.dato DESC, o.klokkeslett DESC) AS n
             FROM skaring s
             JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
             JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
            WHERE o.skolear_fag_id = $1 AND s.slettet IS NULL
              AND sv.teller_ikke = 0)
          WHERE n <= 10 ORDER BY elevId, dato, klokkeslett`,
      [skolearFagId],
    ),
    hent<{
      elevId: string;
      termin: Termin;
      karakter: string | null;
      kommentar: string | null;
    }>(
      `SELECT elev_id AS elevId, termin, karakter, kommentar
           FROM halvarskarakter
          WHERE skolear_fag_id = $1 AND slettet IS NULL`,
      [skolearFagId],
    ),
  ]);

  const inn = new Map<string, (string | null)[]>();
  for (const i of innsats)
    inn.set(i.elevId, [...(inn.get(i.elevId) ?? []), i.farge]);

  return {
    vurderinger: vurderinger.map((v) => ({ ...v, tall: v.tall === 1 })),
    elever,
    resultater: new Map(
      resultater.map((r) => {
        const tellerIkke = r.tellerIkke === 1;
        return [
          `${r.vurderingId}:${r.elevId}`,
          {
            vurderingId: r.vurderingId,
            elevId: r.elevId,
            kode: r.kode,
            tall:
              r.kode && !tellerIkke && TALL.test(r.kode)
                ? Number(r.kode[0]) +
                  (r.kode[1] === "+" ? 0.3 : r.kode[1] === "-" ? -0.3 : 0)
                : null,
            tellerIkke,
            kommentar: r.kommentar,
            rubrikkvalg: lesJson<Rubrikkvalg>(r.rubrikkvalg, {}, "rubrikken"),
            leveranse: r.leveranse,
          },
        ];
      }),
    ),
    innsats: inn,
    halvar: new Map(
      halvar.map((h) => [
        `${h.termin}:${h.elevId}`,
        { karakter: h.karakter, kommentar: h.kommentar },
      ]),
    ),
  };
}

export async function settVekt(
  vurderingId: string,
  vekt: number | null,
): Promise<void> {
  await oppdater("vurdering", vurderingId, { vekt });
  varsleVurderinger();
}

export async function settHalvar(
  elevId: string,
  skolearFagId: string,
  termin: Termin,
  felter: Partial<Halvar>,
): Promise<void> {
  const [f] = await hent<Halvar>(
    `SELECT karakter, kommentar FROM halvarskarakter
      WHERE elev_id = $1 AND skolear_fag_id = $2 AND termin = $3
        AND slettet IS NULL`,
    [elevId, skolearFagId, termin],
  );
  await settInnEllerOppdater(
    "halvarskarakter",
    ["elev_id", "skolear_fag_id", "termin"],
    {
      elev_id: elevId,
      skolear_fag_id: skolearFagId,
      termin,
      karakter:
        felter.karakter !== undefined ? felter.karakter : (f?.karakter ?? null),
      kommentar:
        felter.kommentar !== undefined
          ? felter.kommentar
          : (f?.kommentar ?? null),
    },
  );
}

/** «Muntlig: SWOT» → ["Muntlig", "SWOT"]; uten kolon → [tittel, ""]. */
export function delTittel(tittel: string): [string, string] {
  const i = tittel.indexOf(":");
  if (i <= 0) return [tittel, ""];
  return [tittel.slice(0, i).trim(), tittel.slice(i + 1).trim()];
}
