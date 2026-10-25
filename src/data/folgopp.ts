import { hent, idag, settInnEllerOppdater } from "../db";
import type { Oktrad } from "./oktrader";
import { varsleElever } from "./endringer";

/**
 * Følg opp som egen liste (ARBEIDSLISTE 29.7, lerretet FolgOpp): elevene
 * som trenger noe fra deg, på tvers av fagene. Grunnene: rød sist, ikke
 * sett, borte, frist (ikke levert, møtte ikke til muntlig) og avtale (mål
 * fra mentorsamtalen). «Fulgt opp» tar eleven ut til noe nytt skjer.
 */

export type Grunnslag = "rod" | "ikkesett" | "borte" | "frist" | "avtale";

export const GRUNNAVN: Record<Grunnslag, string> = {
  rod: "Rød sist",
  ikkesett: "Ikke sett",
  borte: "Borte",
  frist: "Frist",
  avtale: "Avtale",
};

export type Grunn = {
  slag: Grunnslag;
  /** hva som skjedde; ny hendelse = ny nøkkel */
  nokkel: string;
  tekst: string;
  /** når det skjedde */
  dato: string;
};

export type Folgopprad = {
  elevId: string;
  /** faget, eller null (mentoravtaler) */
  skolearFagId: string | null;
  grunner: Grunn[];
  /** de siste fire skårene i faget, eldste først: gronn | gul | rod | null */
  innsats: (string | null)[];
  /** den nyeste grunnen */
  dato: string;
};

export type Fristrad = {
  elevId: string;
  skolearFagId: string;
  vurderingId: string;
  tittel: string;
  /** ikke levert, eller møtte ikke til samtalen */
  hva: "ikke" | "motte";
  dato: string | null;
};

export type Avtalerad = {
  id: string;
  elevId: string;
  tekst: string;
  dato: string;
};

const kort = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  return `${dag} ${d.getDate()}.${d.getMonth() + 1}`;
};

/** Grunnene fra øktene: per elev og fag, ut fra de siste avholdte øktene. */
export function grunnerFraOkter(rader: Oktrad[]): Map<string, Grunn[]> {
  const perElevFag = new Map<string, Oktrad[]>();
  for (const r of rader) {
    const k = `${r.elevId}|${r.skolearFagId}`;
    perElevFag.set(k, [...(perElevFag.get(k) ?? []), r]);
  }
  const ut = new Map<string, Grunn[]>();
  for (const [k, liste] of perElevFag) {
    const sortert = [...liste].sort(
      (a, b) =>
        a.dato.localeCompare(b.dato) ||
        (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
    );
    const sist = sortert[sortert.length - 1];
    if (!sist) continue;
    const g: Grunn[] = [];
    if (!sist.borte && sist.farge === "rod") {
      const forrige = sortert[sortert.length - 2];
      const to = forrige && !forrige.borte && forrige.farge === "rod";
      g.push({
        slag: "rod",
        nokkel: `rod:${sist.oktId}`,
        tekst: to ? "Rød de to siste øktene" : "Rød i siste økt",
        dato: sist.dato,
      });
    }
    if (sist.borte) {
      g.push({
        slag: "borte",
        nokkel: `borte:${sist.oktId}`,
        tekst: `Borte ${kort(sist.dato)}`,
        dato: sist.dato,
      });
    }
    if (sist.ikkeSett) {
      let n = 0;
      for (let i = sortert.length - 1; i >= 0 && sortert[i].ikkeSett; i--) n++;
      if (n >= 2)
        g.push({
          slag: "ikkesett",
          nokkel: `ikkesett:${sist.oktId}`,
          tekst: `Ikke sett på ${n} økter (til stede, men ikke skåret)`,
          dato: sortert[sortert.length - n].dato,
        });
    }
    if (g.length) ut.set(k, g);
  }
  return ut;
}

/** Tid siden: «i dag», «2 dager», «2 uker». */
export function siden(dato: string, iDag: string): string {
  const d = Math.round(
    (Date.parse(`${iDag}T12:00:00`) - Date.parse(`${dato}T12:00:00`)) /
      86_400_000,
  );
  if (d <= 0) return d < 0 ? kort(dato) : "i dag";
  if (d === 1) return "i går";
  if (d < 14) return `${d} dager`;
  if (d < 60) return `${Math.round(d / 7)} uker`;
  return `${Math.round(d / 30)} mnd`;
}

export function byggFolgOpp({
  rader,
  frister,
  avtaler,
  fulgt,
}: {
  rader: Oktrad[];
  frister: Fristrad[];
  avtaler: Avtalerad[];
  /** `${elevId}|${nokkel}` som er fulgt opp */
  fulgt: Set<string>;
}): Folgopprad[] {
  const perNokkel = new Map<string, Folgopprad>();
  const rad = (elevId: string, fag: string | null) => {
    const k = `${elevId}|${fag ?? ""}`;
    let r = perNokkel.get(k);
    if (!r) {
      r = { elevId, skolearFagId: fag, grunner: [], innsats: [], dato: "" };
      perNokkel.set(k, r);
    }
    return r;
  };
  for (const [k, g] of grunnerFraOkter(rader)) {
    const [elevId, fag] = k.split("|");
    rad(elevId, fag).grunner.push(...g);
  }
  for (const f of frister)
    rad(f.elevId, f.skolearFagId).grunner.push({
      slag: "frist",
      nokkel: `frist:${f.vurderingId}:${f.hva}`,
      tekst:
        f.hva === "ikke"
          ? `${f.tittel} ikke levert${f.dato ? `, frist ${kort(f.dato)}` : ""}`
          : `Møtte ikke til ${f.tittel}${f.dato ? ` ${kort(f.dato)}` : ""} · ny tid må avtales`,
      dato: f.dato ?? "",
    });
  for (const a of avtaler)
    rad(a.elevId, null).grunner.push({
      slag: "avtale",
      nokkel: `avtale:${a.id}`,
      tekst: `Avtale: «${a.tekst}»`,
      dato: a.dato,
    });

  // Innsatsen per elev og fag, de fire siste.
  const innsats = new Map<string, (string | null)[]>();
  for (const r of [...rader].sort((a, b) => a.dato.localeCompare(b.dato))) {
    if (r.borte || r.ikkeSett) continue;
    const k = `${r.elevId}|${r.skolearFagId}`;
    innsats.set(k, [...(innsats.get(k) ?? []), r.farge].slice(-4));
  }

  return [...perNokkel.values()]
    .map((r) => ({
      ...r,
      grunner: r.grunner.filter((g) => !fulgt.has(`${r.elevId}|${g.nokkel}`)),
      innsats: r.skolearFagId
        ? (innsats.get(`${r.elevId}|${r.skolearFagId}`) ?? [])
        : [],
    }))
    .filter((r) => r.grunner.length > 0)
    .map((r) => ({
      ...r,
      dato: r.grunner.reduce((m, g) => (g.dato > m ? g.dato : m), ""),
    }))
    .sort((a, b) => b.dato.localeCompare(a.dato));
}

// ------------------------------------------------------------------ basen

/**
 * Det som har passert fristen og ikke er levert, og muntlige samtaler der
 * eleven ikke møtte og ikke har fått karakter.
 */
export async function hentFrister(skolearId: string): Promise<Fristrad[]> {
  const i = idag();
  const [ikke, motte] = await Promise.all([
    hent<Fristrad>(
      `SELECT r.elev_id AS elevId, v.skolear_fag_id AS skolearFagId,
              v.id AS vurderingId, v.tittel, 'ikke' AS hva, v.frist AS dato
         FROM vurderingsresultat r
         JOIN vurdering v ON v.id = r.vurdering_id AND v.slettet IS NULL
         JOIN skolear_fag sf ON sf.id = v.skolear_fag_id
                            AND sf.slettet IS NULL AND sf.skolear_id = $1
        WHERE r.slettet IS NULL AND r.leveranse = 'ikke'
          AND r.skalaverdi_id IS NULL
          AND (v.frist IS NULL OR v.frist <= $2)`,
      [skolearId, i],
    ),
    hent<Fristrad>(
      `SELECT s.elev_id AS elevId, d.skolear_fag_id AS skolearFagId,
              v.id AS vurderingId, v.tittel, 'motte' AS hva, d.dato
         FROM samtale s
         JOIN samtaledag d ON d.id = s.samtaledag_id AND d.slettet IS NULL
         JOIN vurdering v ON v.id = d.vurdering_id AND v.slettet IS NULL
        WHERE d.skolear_id = $1 AND s.slettet IS NULL AND s.motte = 0
          AND d.dato <= $2
          AND NOT EXISTS (SELECT 1 FROM vurderingsresultat r
                           WHERE r.vurdering_id = v.id
                             AND r.elev_id = s.elev_id
                             AND r.slettet IS NULL
                             AND r.skalaverdi_id IS NOT NULL)`,
      [skolearId, i],
    ),
  ]);
  return [...ikke, ...motte];
}

/** Mål og avtaler fra mentorsamtalene som ikke er nådd. */
export async function hentAvtalerTilFolgOpp(): Promise<Avtalerad[]> {
  return hent<Avtalerad>(
    `SELECT m.id, m.elev_id AS elevId, m.tekst,
            COALESCE(d.dato, substr(m.opprettet, 1, 10)) AS dato
       FROM samtalemal m
       JOIN elev e ON e.id = m.elev_id AND e.slettet IS NULL
       LEFT JOIN samtale s ON s.id = m.samtale_id
       LEFT JOIN samtaledag d ON d.id = s.samtaledag_id
      WHERE m.slettet IS NULL AND m.nadd IS NULL`,
  );
}

export async function hentFulgt(): Promise<Set<string>> {
  const rader = await hent<{ elevId: string; nokkel: string }>(
    "SELECT elev_id AS elevId, nokkel FROM fulgt_opp WHERE slettet IS NULL",
  );
  return new Set(rader.map((r) => `${r.elevId}|${r.nokkel}`));
}

/** «Fulgt opp ✓»: grunnene er tatt hånd om, til noe nytt skjer. */
export async function settFulgtOpp(
  elevId: string,
  nokler: string[],
): Promise<void> {
  for (const nokkel of nokler)
    await settInnEllerOppdater("fulgt_opp", ["elev_id", "nokkel"], {
      elev_id: elevId,
      nokkel,
      dato: idag(),
    });
  varsleElever();
}

/**
 * Teksten «Til samtale» legger på neste samtale. Avtaler står der fra før
 * (de kommer fra en samtale), så de tas ikke med på nytt; ellers ville
 * «Avtale: «…»» bli pakket inn én gang til ved hvert klikk. null = ingenting
 * å legge til.
 */
export function samtaletekst(
  grunner: { slag: Grunnslag; tekst: string }[],
): string | null {
  const t = grunner.filter((g) => g.slag !== "avtale").map((g) => g.tekst);
  return t.length ? t.join(" · ") : null;
}
