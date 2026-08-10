import { hent, oppdater, settInn, slett } from "../db";
import type { Okt } from "./okter";

/**
 * Perioder, SPEC §3.3 og §4.2.
 *
 * Periodisering er et hjelpemiddel i planleggingen, ikke et krav. Øktene
 * virker like godt uten. Legger du inn perioder, får du se om året henger
 * sammen — om november er overbooket eller et tema har fått for få timer.
 *
 * `start` og `slutt` er den planlagte intensjonen. Det faktiske spennet
 * utledes av øktene som faller i perioden, og avvik mellom dem er nyttig
 * informasjon, ikke en feil å skjule.
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
};

export async function hentPerioder(skolearFagId: string): Promise<Periode[]> {
  return hent<Periode>(
    `SELECT id, skolear_fag_id AS skolearFagId, navn, rekkefolge,
            start, slutt, kompetansemal, notat
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
  return settInn("periode", {
    skolear_fag_id: skolearFagId,
    navn,
    start,
    slutt,
    rekkefolge,
  });
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
}

/** Sletter perioden, ikke øktene. De blir stående som uplasserte. */
export async function slettPeriode(id: string): Promise<void> {
  await slett("periode", id);
}

// ------------------------------------------------------------- plassering

/**
 * Hvilken periode ei økt hører til.
 *
 * Datoen bestemmer: ligger økta innenfor periodens spenn, hører den dit.
 * Flytter du en periodegrense, flytter øktene seg med — det er slik man
 * faktisk planlegger, ved å bestemme at oktober er markedsanalyse.
 *
 * `okt.periode_id` overstyrer likevel alltid. Har du sagt uttrykkelig at
 * denne økta hører til forrige tema, skal ikke appen overprøve deg.
 */
export function periodeFor(okt: Okt, perioder: Periode[]): Periode | null {
  if (okt.periodeId) {
    const satt = perioder.find((p) => p.id === okt.periodeId);
    if (satt) return satt;
  }

  return (
    perioder.find(
      (p) =>
        p.start !== null &&
        p.slutt !== null &&
        okt.dato >= p.start &&
        okt.dato <= p.slutt,
    ) ?? null
  );
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
            p.start, p.slutt, p.kompetansemal, p.notat
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
  const [finnes] = await hent<{ id: string; slettet: string | null }>(
    "SELECT id, slettet FROM periode_kompetansemal WHERE periode_id = $1 AND kode = $2",
    [periodeId, kode],
  );

  if (!finnes) {
    if (pa) await settInn("periode_kompetansemal", { periode_id: periodeId, kode });
    return;
  }
  if (pa && finnes.slettet !== null) {
    await oppdater("periode_kompetansemal", finnes.id, { slettet: null });
  } else if (!pa && finnes.slettet === null) {
    await slett("periode_kompetansemal", finnes.id);
  }
}

/** Alle kodene som er dekket av minst én periode i faget. */
export async function hentDekkedeMal(skolearFagId: string): Promise<Set<string>> {
  const kart = await hentPeriodemal(skolearFagId);
  return new Set([...kart.values()].flat());
}
