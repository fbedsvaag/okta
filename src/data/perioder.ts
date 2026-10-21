import { hent, oppdater, settInn, slett } from "../db";
import type { Okt } from "./okter";
import { varsle } from "./endringer";

/**
 * Perioder, SPEC §3.3 og §4.2.
 *
 * Periodisering er et hjelpemiddel i planleggingen, ikke et krav. Øktene
 * virker like godt uten. Legger du inn perioder, får du se om året henger
 * sammen — om november er overbooket eller et tema har fått for få timer.
 *
 * Perioden står på økta (`okt.periode_id`), som en merkelapp. Den settes
 * ved å merke øktene i lista og trykke P (`fargelegg` — navnet er fra da
 * det var en pensel), og `start`/`slutt` følger øktene som har perioden.
 */

export type Periode = {
  id: string;
  skolearFagId: string;
  navn: string;
  rekkefolge: number;
  start: string | null;
  slutt: string | null;
  kompetansemal: string | null;
  notat: string | null;
  /** fargen perioden har i lista; settes når perioden lages */
  farge: string | null;
};

/**
 * Fargene periodene får, i tur og orden. Dempede og tydelig forskjellige fra
 * hverandre — de brukes som en svak tone over hele raden, og som en strek.
 */
export const PERIODEFARGER = [
  "#c9793a",
  "#4f8a8b",
  "#9b5d8f",
  "#6f8f3a",
  "#c2574e",
  "#5a7bb5",
  "#b08c2e",
  "#7d6bb0",
] as const;

export async function hentPerioder(skolearFagId: string): Promise<Periode[]> {
  return hent<Periode>(
    `SELECT id, skolear_fag_id AS skolearFagId, navn, rekkefolge,
            start, slutt, kompetansemal, notat, farge
       FROM periode
      WHERE skolear_fag_id = $1 AND slettet IS NULL
      ORDER BY start IS NULL, start, rekkefolge`,
    [skolearFagId],
  );
}

export async function opprettPeriode(
  skolearFagId: string,
  navn: string,
  start: string | null,
  slutt: string | null,
  rekkefolge: number,
): Promise<string> {
  // Neste farge i rekka, etter hvor mange perioder faget har hatt — også
  // slettede, så en ny periode ikke får samme farge som den som nettopp ble
  // borte.
  const [{ n }] = await hent<{ n: number }>(
    "SELECT COUNT(*) AS n FROM periode WHERE skolear_fag_id = $1",
    [skolearFagId],
  );
  const id = await settInn("periode", {
    skolear_fag_id: skolearFagId,
    navn,
    start,
    slutt,
    rekkefolge,
    farge: PERIODEFARGER[n % PERIODEFARGER.length],
  });
  if (start && slutt) await fargeleggSpenn(id, skolearFagId, start, slutt);
  return id;
}

export async function endrePeriode(
  id: string,
  felter: {
    navn?: string;
    start?: string | null;
    slutt?: string | null;
    kompetansemal?: string | null;
    notat?: string | null;
  },
): Promise<void> {
  await oppdater("periode", id, felter);

  // Nytt spenn fra periodevisningen: øktene innenfor farges med perioden.
  if (felter.start !== undefined || felter.slutt !== undefined) {
    const [p] = await hent<{
      skolearFagId: string;
      start: string | null;
      slutt: string | null;
    }>(
      "SELECT skolear_fag_id AS skolearFagId, start, slutt FROM periode WHERE id = $1",
      [id],
    );
    if (p?.start && p.slutt)
      await fargeleggSpenn(id, p.skolearFagId, p.start, p.slutt);
  }
  varsle();
}

async function fargeleggSpenn(
  periodeId: string,
  skolearFagId: string,
  start: string,
  slutt: string,
): Promise<void> {
  const okter = await hent<{ id: string }>(
    `SELECT id FROM okt
      WHERE skolear_fag_id = $1 AND dato BETWEEN $2 AND $3
        AND slettet IS NULL`,
    [skolearFagId, start, slutt],
  );
  for (const o of okter) await oppdater("okt", o.id, { periode_id: periodeId });
}

/**
 * Fargelegger øktene med en periode — eller tar perioden bort (null).
 *
 * Etterpå følger periodenes spenn det som faktisk er farget: `start` og
 * `slutt` blir første og siste økt i perioden. En periode som mister alle
 * øktene sine, beholder spennet den hadde.
 */
/** Periodenes start og slutt settes etter øktene de har. */
export async function oppdaterPeriodespenn(
  periodeIder: string[],
): Promise<void> {
  for (const p of new Set(periodeIder)) {
    const [spenn] = await hent<{ fra: string | null; til: string | null }>(
      `SELECT MIN(dato) AS fra, MAX(dato) AS til FROM okt
        WHERE periode_id = $1 AND slettet IS NULL`,
      [p],
    );
    if (spenn?.fra && spenn.til)
      await oppdater("periode", p, { start: spenn.fra, slutt: spenn.til });
  }
}

export async function fargelegg(
  oktIder: string[],
  periodeId: string | null,
): Promise<void> {
  if (oktIder.length === 0) return;

  const berorte = new Set<string>();
  if (periodeId) berorte.add(periodeId);
  for (const id of oktIder) {
    const [o] = await hent<{ periodeId: string | null }>(
      "SELECT periode_id AS periodeId FROM okt WHERE id = $1",
      [id],
    );
    if (o?.periodeId) berorte.add(o.periodeId);
    if (o?.periodeId !== periodeId)
      await oppdater("okt", id, { periode_id: periodeId });
  }

  await oppdaterPeriodespenn([...berorte]);
}

/** Sletter perioden, ikke øktene. De blir stående som uplasserte. */
export async function slettPeriode(id: string): Promise<void> {
  await slett("periode", id);
}

// ------------------------------------------------------------- plassering

/**
 * Hvilken periode ei økt hører til: den den er farget med. Datoene bestemmer
 * ikke lenger — de følger fargeleggingen (se `fargelegg`).
 */
export function periodeFor(okt: Okt, perioder: Periode[]): Periode | null {
  if (!okt.periodeId) return null;
  return perioder.find((p) => p.id === okt.periodeId) ?? null;
}

export type Plassering = {
  periode: Periode | null;
  okter: Okt[];
  minutter: number;
  /** Faktisk spenn utledet av øktene. null når perioden er tom. */
  faktiskFra: string | null;
  faktiskTil: string | null;
};

/**
 * Fordeler øktene på periodene. Perioder uten økter blir med — det er
 * nettopp de hullene man vil oppdage. Uplasserte økter kommer sist, med
 * `periode: null`, så de aldri blir usynlige.
 */
export function fordel(okter: Okt[], perioder: Periode[]): Plassering[] {
  const bunker = new Map<string | null, Okt[]>();
  for (const p of perioder) bunker.set(p.id, []);
  bunker.set(null, []);

  for (const okt of okter) {
    const p = periodeFor(okt, perioder);
    bunker.get(p?.id ?? null)!.push(okt);
  }

  const lag = (periode: Periode | null): Plassering => {
    const egne = (bunker.get(periode?.id ?? null) ?? []).sort((a, b) =>
      a.dato.localeCompare(b.dato),
    );
    return {
      periode,
      okter: egne,
      minutter: egne.reduce((s, o) => s + o.varighetMin, 0),
      faktiskFra: egne.length > 0 ? egne[0].dato : null,
      faktiskTil: egne.length > 0 ? egne[egne.length - 1].dato : null,
    };
  };

  const plasserte = perioder.map(lag);
  const uplasserte = lag(null);

  return uplasserte.okter.length > 0 ? [...plasserte, uplasserte] : plasserte;
}

/** Perioder som overlapper hverandre i tid — verdt å si fra om. */
export function overlapp(perioder: Periode[]): [Periode, Periode][] {
  const med = perioder.filter((p) => p.start && p.slutt);
  const treff: [Periode, Periode][] = [];

  for (let i = 0; i < med.length; i++) {
    for (let j = i + 1; j < med.length; j++) {
      const a = med[i];
      const b = med[j];
      if (a.start! <= b.slutt! && b.start! <= a.slutt!) treff.push([a, b]);
    }
  }
  return treff;
}

/** Alle perioder i skoleåret, på tvers av fag. Til lista i §4.2. */
export async function hentAllePerioder(skolearId: string): Promise<Periode[]> {
  return hent<Periode>(
    `SELECT p.id, p.skolear_fag_id AS skolearFagId, p.navn, p.rekkefolge,
            p.start, p.slutt, p.kompetansemal, p.notat, p.farge
       FROM periode p
       JOIN skolear_fag sf ON sf.id = p.skolear_fag_id AND sf.slettet IS NULL
      WHERE p.slettet IS NULL AND sf.skolear_id = $1
      ORDER BY p.start IS NULL, p.start, p.rekkefolge`,
    [skolearId],
  );
}

// ------------------------------------------------------- kompetansemål

/**
 * Kompetansemålene knyttet til periodene i ett fag.
 *
 * Returnerer koder, ikke tekst. Teksten ligger i `grep-fag.json` og slås opp
 * der — basen skal ikke ha sin egen kopi av Udirs formuleringer.
 */
export async function hentPeriodemal(
  skolearFagId: string,
): Promise<Map<string, string[]>> {
  const rader = await hent<{ periodeId: string; kode: string }>(
    `SELECT pk.periode_id AS periodeId, pk.kode
       FROM periode_kompetansemal pk
       JOIN periode p ON p.id = pk.periode_id AND p.slettet IS NULL
      WHERE pk.slettet IS NULL AND p.skolear_fag_id = $1
      ORDER BY pk.kode`,
    [skolearFagId],
  );

  const kart = new Map<string, string[]>();
  for (const r of rader) {
    kart.set(r.periodeId, [...(kart.get(r.periodeId) ?? []), r.kode]);
  }
  return kart;
}

/**
 * Slår et kompetansemål av eller på for en periode.
 *
 * Soft delete og UNIQUE krangler (§12): en rad som er fjernet opptar fortsatt
 * plassen sin i den unike indeksen. Derfor gjenbrukes den i stedet for at vi
 * setter inn en ny.
 */
export async function settPeriodemal(
  periodeId: string,
  kode: string,
  pa: boolean,
): Promise<void> {
  await settMal("periode_kompetansemal", "periode_id", periodeId, kode, pa);
}

/** Kompetansemålkodene per økt i ett fag, til årsplanarket. */
export async function hentOktmalForFag(
  skolearFagId: string,
): Promise<Map<string, string[]>> {
  const rader = await hent<{ oktId: string; kode: string }>(
    `SELECT om.okt_id AS oktId, om.kode
       FROM okt_kompetansemal om
       JOIN okt o ON o.id = om.okt_id AND o.slettet IS NULL
      WHERE om.slettet IS NULL AND o.skolear_fag_id = $1
      ORDER BY om.kode`,
    [skolearFagId],
  );
  const kart = new Map<string, string[]>();
  for (const r of rader)
    kart.set(r.oktId, [...(kart.get(r.oktId) ?? []), r.kode]);
  return kart;
}

/** Det samme for en økt. */
export async function settOktmal(
  oktId: string,
  kode: string,
  pa: boolean,
): Promise<void> {
  await settMal("okt_kompetansemal", "okt_id", oktId, kode, pa);
}

async function settMal(
  tabell: "periode_kompetansemal" | "okt_kompetansemal",
  kolonne: "periode_id" | "okt_id",
  id: string,
  kode: string,
  pa: boolean,
): Promise<void> {
  const [finnes] = await hent<{ id: string; slettet: string | null }>(
    `SELECT id, slettet FROM ${tabell} WHERE ${kolonne} = $1 AND kode = $2`,
    [id, kode],
  );

  if (!finnes) {
    if (pa) await settInn(tabell, { [kolonne]: id, kode });
    return;
  }
  if (pa && finnes.slettet !== null) {
    await oppdater(tabell, finnes.id, { slettet: null });
  } else if (!pa && finnes.slettet === null) {
    await slett(tabell, finnes.id);
  }
}

export type Oktmal = {
  /** fagets Udir-kode; uten den finnes ingen liste å velge fra */
  grepKode: string | null;
  /** målene som er huket av for akkurat denne økta */
  egne: string[];
  /** målene perioden økta ligger i dekker — de gjelder økta også */
  fraPeriode: string[];
  periodeNavn: string | null;
  /** målene som er dekket av en periode eller en annen økt i faget */
  dekketAndreSteder: Set<string>;
  /** `okt.kompetansemal` — fritekst for fag uten Udir-kode */
  fritekst: string | null;
};

/**
 * Kompetansemålene for én økt: dens egne, og dem den arver fra perioden.
 * Koder, ikke tekst — teksten slås opp i `grep-fag.json`.
 */
export async function hentOktmal(oktId: string): Promise<Oktmal> {
  const [okt] = await hent<{
    skolearFagId: string;
    periodeId: string | null;
    periodeNavn: string | null;
    grepKode: string | null;
    fritekst: string | null;
  }>(
    `SELECT o.skolear_fag_id AS skolearFagId, o.periode_id AS periodeId,
            o.kompetansemal AS fritekst,
            p.navn AS periodeNavn, f.grep_kode AS grepKode
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
       JOIN fag f          ON f.id = sf.fag_id
       LEFT JOIN periode p ON p.id = o.periode_id AND p.slettet IS NULL
      WHERE o.id = $1`,
    [oktId],
  );
  if (!okt) {
    return {
      grepKode: null,
      egne: [],
      fraPeriode: [],
      periodeNavn: null,
      dekketAndreSteder: new Set(),
      fritekst: null,
    };
  }

  const egne = await hent<{ kode: string }>(
    `SELECT kode FROM okt_kompetansemal
      WHERE okt_id = $1 AND slettet IS NULL ORDER BY kode`,
    [oktId],
  );
  const perioder = await hentPeriodemal(okt.skolearFagId);
  const andreOkter = await hent<{ kode: string }>(
    `SELECT DISTINCT om.kode FROM okt_kompetansemal om
       JOIN okt o ON o.id = om.okt_id AND o.slettet IS NULL
      WHERE om.slettet IS NULL AND o.skolear_fag_id = $1 AND o.id <> $2`,
    [okt.skolearFagId, oktId],
  );

  const fraPeriode = okt.periodeNavn
    ? (perioder.get(okt.periodeId!) ?? [])
    : [];
  const dekket = new Set([
    ...[...perioder.entries()]
      .filter(([id]) => id !== okt.periodeId)
      .flatMap(([, koder]) => koder),
    ...andreOkter.map((r) => r.kode),
  ]);

  return {
    grepKode: okt.grepKode,
    egne: egne.map((r) => r.kode),
    fraPeriode,
    periodeNavn: okt.periodeNavn,
    dekketAndreSteder: dekket,
    fritekst: okt.fritekst,
  };
}

/** Alle kodene som er dekket av minst én periode i faget. */
export async function hentDekkedeMal(
  skolearFagId: string,
): Promise<Set<string>> {
  const kart = await hentPeriodemal(skolearFagId);
  return new Set([...kart.values()].flat());
}
