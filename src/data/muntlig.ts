import { hent, nyId, oppdater, settInn, slett } from "../db";
import { lesJson } from "./json";
import { varsleVurderinger } from "./endringer";

/**
 * Muntlig vurdering (ARBEIDSLISTE 28.1–28.5): oppgavekort, kriterier eller
 * rubrikk, og det som velges per elev under samtalen. Tidsplanen er
 * samtaledager med vurderingens id (`data/tidsplan.ts`).
 */

// ------------------------------------------------------------------ rubrikk

export type Niva = { id: string; navn: string };
export type Kriterium = {
  id: string;
  tekst: string;
  /** nivå-id → beskrivelse */
  celler: Record<string, string>;
};
export type Rubrikk = { nivaer: Niva[]; kriterier: Kriterium[] };
export type Vurderingsform = "kriterier" | "rubrikk";
/** kriterium-id → nivå-id (rubrikk) eller true (avkrysning) */
export type Rubrikkvalg = Record<string, string | true>;

/** En ny rubrikk: Lav · Middels · Høy og ett tomt kriterium. */
export function tomRubrikk(lagId: () => string = nyId): Rubrikk {
  return {
    nivaer: ["Lav", "Middels", "Høy"].map((navn) => ({ id: lagId(), navn })),
    kriterier: [{ id: lagId(), tekst: "", celler: {} }],
  };
}

/** En kopi med nye id-er, til en mal som brukes eller lagres. */
export function kopierRubrikk(r: Rubrikk, lagId: () => string = nyId): Rubrikk {
  const nye = new Map(r.nivaer.map((n) => [n.id, lagId()]));
  return {
    nivaer: r.nivaer.map((n) => ({ id: nye.get(n.id)!, navn: n.navn })),
    kriterier: r.kriterier.map((k) => ({
      id: lagId(),
      tekst: k.tekst,
      celler: Object.fromEntries(
        Object.entries(k.celler)
          .filter(([n]) => nye.has(n))
          .map(([n, t]) => [nye.get(n)!, t]),
      ),
    })),
  };
}

export function lesRubrikk(tekst: string | null): Rubrikk | null {
  const r = lesJson<Rubrikk | null>(tekst, null, "rubrikken");
  if (!r || !Array.isArray(r.nivaer) || !Array.isArray(r.kriterier))
    return null;
  return r;
}

/** Kriteriene som teller: de med tekst. */
export function kriterierMedTekst(r: Rubrikk): Kriterium[] {
  return r.kriterier.filter((k) => k.tekst.trim() !== "");
}

/**
 * Karakteren rubrikken peker mot, når alle kriteriene er vurdert: snittet
 * av nivåene, lagt på 2–6 (laveste nivå er 2, høyeste 6). Bare et
 * forslag; læreren bestemmer selv.
 */
export function karakterforslag(r: Rubrikk, valg: Rubrikkvalg): number | null {
  const krit = kriterierMedTekst(r);
  if (krit.length === 0 || r.nivaer.length < 2) return null;
  let sum = 0;
  for (const k of krit) {
    const v = valg[k.id];
    const i = r.nivaer.findIndex((n) => n.id === v);
    if (i < 0) return null;
    sum += i / (r.nivaer.length - 1);
  }
  return Math.round(2 + (4 * sum) / krit.length);
}

/** Hvor mange av kriteriene som er vurdert. */
export function antallVurdert(r: Rubrikk, valg: Rubrikkvalg): number {
  return kriterierMedTekst(r).filter((k) =>
    r.nivaer.some((n) => n.id === valg[k.id]),
  ).length;
}

// ------------------------------------------------------------- vurderingen

export type Muntligoppsett = {
  form: Vurderingsform;
  rubrikk: Rubrikk;
  samtaleMin: number;
  pauseMin: number;
  trekkFlere: boolean;
  trekkNa: boolean;
  /** minutter og pause er satt på vurderingen (ellers standard) */
  egneTider: boolean;
};

export const STANDARD_MIN = 12;
export const STANDARD_PAUSE = 3;

export async function hentMuntlig(
  vurderingId: string,
): Promise<Muntligoppsett> {
  const [r] = await hent<{
    form: string | null;
    rubrikk: string | null;
    samtaleMin: number | null;
    pauseMin: number | null;
    trekkFlere: number;
    trekkNa: number;
  }>(
    `SELECT vurderingsform AS form, rubrikk, samtale_min AS samtaleMin,
            pause_min AS pauseMin, trekk_flere AS trekkFlere,
            trekk_na AS trekkNa
       FROM vurdering WHERE id = $1`,
    [vurderingId],
  );
  return {
    form: r?.form === "rubrikk" ? "rubrikk" : "kriterier",
    rubrikk: lesRubrikk(r?.rubrikk ?? null) ?? tomRubrikk(),
    samtaleMin: r?.samtaleMin ?? STANDARD_MIN,
    pauseMin: r?.pauseMin ?? STANDARD_PAUSE,
    trekkFlere: (r?.trekkFlere ?? 1) === 1,
    trekkNa: (r?.trekkNa ?? 1) === 1,
    egneTider: r?.samtaleMin != null,
  };
}

export async function settMuntlig(
  vurderingId: string,
  felter: Partial<Muntligoppsett>,
): Promise<void> {
  const ut: Record<string, unknown> = {};
  if (felter.form) ut.vurderingsform = felter.form;
  if (felter.rubrikk) ut.rubrikk = JSON.stringify(felter.rubrikk);
  if (felter.samtaleMin !== undefined) ut.samtale_min = felter.samtaleMin;
  if (felter.pauseMin !== undefined) ut.pause_min = felter.pauseMin;
  if (felter.trekkFlere !== undefined)
    ut.trekk_flere = felter.trekkFlere ? 1 : 0;
  if (felter.trekkNa !== undefined) ut.trekk_na = felter.trekkNa ? 1 : 0;
  await oppdater("vurdering", vurderingId, ut);
  varsleVurderinger();
}

// ------------------------------------------------------------- oppgavekort

export type Oppgavekort = {
  id: string;
  nr: number;
  tittel: string;
  beskrivelse: string;
  sporsmal: string[];
};

export async function hentOppgavekort(
  vurderingId: string,
): Promise<Oppgavekort[]> {
  const rader = await hent<{
    id: string;
    nr: number;
    tittel: string;
    beskrivelse: string | null;
    sporsmal: string | null;
  }>(
    `SELECT id, nr, tittel, beskrivelse, sporsmal FROM oppgavekort
      WHERE vurdering_id = $1 AND slettet IS NULL ORDER BY nr`,
    [vurderingId],
  );
  return rader.map((r) => ({
    ...r,
    beskrivelse: r.beskrivelse ?? "",
    sporsmal: lesJson<string[]>(r.sporsmal, [], "spørsmålene"),
  }));
}

export async function nyttOppgavekort(
  vurderingId: string,
  nr: number,
  kort: Partial<Omit<Oppgavekort, "id" | "nr">> = {},
): Promise<string> {
  const id = await settInn("oppgavekort", {
    vurdering_id: vurderingId,
    nr,
    tittel: kort.tittel ?? "",
    beskrivelse: kort.beskrivelse ?? null,
    sporsmal: JSON.stringify(kort.sporsmal ?? [""]),
  });
  varsleVurderinger();
  return id;
}

export async function endreOppgavekort(
  id: string,
  kort: Partial<Omit<Oppgavekort, "id">>,
): Promise<void> {
  const ut: Record<string, unknown> = {};
  if (kort.nr !== undefined) ut.nr = kort.nr;
  if (kort.tittel !== undefined) ut.tittel = kort.tittel;
  if (kort.beskrivelse !== undefined) ut.beskrivelse = kort.beskrivelse || null;
  if (kort.sporsmal !== undefined) ut.sporsmal = JSON.stringify(kort.sporsmal);
  await oppdater("oppgavekort", id, ut);
  varsleVurderinger();
}

export async function slettOppgavekort(id: string): Promise<void> {
  await slett("oppgavekort", id);
  varsleVurderinger();
}

/**
 * Oppgaven en elev trekker: tilfeldig blant kortene med tittel. Kan en
 * oppgave ikke trekkes flere ganger, holdes de som er trukket utenfor så
 * lenge det finnes andre.
 */
export function trekkOppgave(
  titler: string[],
  trukket: string[],
  flere: boolean,
  utenom: string | null,
  tilfeldig: () => number = Math.random,
): string | null {
  const alle = titler.filter((t) => t.trim() !== "");
  let kandidater = alle.filter((t) => t !== utenom);
  if (!flere) {
    const ledige = kandidater.filter((t) => !trukket.includes(t));
    if (ledige.length > 0) kandidater = ledige;
  }
  if (kandidater.length === 0) return alle[0] ?? null;
  return kandidater[Math.floor(tilfeldig() * kandidater.length)];
}

// ------------------------------------------------------------------ maler

export type Rubrikkmal = { id: string; navn: string; rubrikk: Rubrikk };

export async function hentRubrikkmaler(): Promise<Rubrikkmal[]> {
  const rader = await hent<{ id: string; navn: string; innhold: string }>(
    `SELECT id, navn, innhold FROM rubrikkmal
      WHERE slettet IS NULL ORDER BY navn`,
  );
  return rader.flatMap((r) => {
    const rubrikk = lesRubrikk(r.innhold);
    return rubrikk ? [{ id: r.id, navn: r.navn, rubrikk }] : [];
  });
}

export async function lagreRubrikkmal(
  navn: string,
  rubrikk: Rubrikk,
): Promise<string> {
  return settInn("rubrikkmal", {
    navn,
    innhold: JSON.stringify(kopierRubrikk(rubrikk)),
  });
}

export async function endreRubrikkmal(id: string, navn: string): Promise<void> {
  await oppdater("rubrikkmal", id, { navn });
}

export async function slettRubrikkmal(id: string): Promise<void> {
  await slett("rubrikkmal", id);
}

// -------------------------------------------------------------- per elev

export type Leveranse = "levert" | "ikke" | "borte";

export type Muntligresultat = {
  elevId: string;
  skalaverdiId: string | null;
  kommentar: string | null;
  leveranse: Leveranse | null;
  rubrikkvalg: Rubrikkvalg;
  stilte: number[];
};

export async function hentMuntligResultater(
  vurderingId: string,
): Promise<Map<string, Muntligresultat>> {
  const rader = await hent<{
    elevId: string;
    skalaverdiId: string | null;
    kommentar: string | null;
    rubrikkvalg: string | null;
    stilte: string | null;
    leveranse: Leveranse | null;
  }>(
    `SELECT elev_id AS elevId, skalaverdi_id AS skalaverdiId, kommentar,
            rubrikkvalg, stilte, leveranse
       FROM vurderingsresultat
      WHERE vurdering_id = $1 AND slettet IS NULL`,
    [vurderingId],
  );
  return new Map(
    rader.map((r) => [
      r.elevId,
      {
        ...r,
        rubrikkvalg: lesJson<Rubrikkvalg>(r.rubrikkvalg, {}, "rubrikkvalget"),
        stilte: lesJson<number[]>(r.stilte, [], "spørsmålene"),
      },
    ]),
  );
}

/**
 * Skriver felter på elevens resultat, og lager det om det mangler. Var det
 * slettet, kommer det tilbake uten den gamle karakteren.
 */
export async function oppdaterResultat(
  vurderingId: string,
  elevId: string,
  felter: {
    skalaverdiId?: string | null;
    kommentar?: string | null;
    rubrikkvalg?: Rubrikkvalg;
    stilte?: number[];
    leveranse?: Leveranse | null;
  },
): Promise<void> {
  const ut: Record<string, unknown> = {};
  if (felter.leveranse !== undefined) {
    ut.leveranse = felter.leveranse;
    ut.levert = felter.leveranse === "levert" ? 1 : 0;
  }
  if (felter.skalaverdiId !== undefined) ut.skalaverdi_id = felter.skalaverdiId;
  if (felter.kommentar !== undefined) ut.kommentar = felter.kommentar;
  if (felter.rubrikkvalg !== undefined)
    ut.rubrikkvalg = JSON.stringify(felter.rubrikkvalg);
  if (felter.stilte !== undefined) ut.stilte = JSON.stringify(felter.stilte);
  const [r] = await hent<{ id: string; slettet: string | null }>(
    `SELECT id, slettet FROM vurderingsresultat
      WHERE vurdering_id = $1 AND elev_id = $2`,
    [vurderingId, elevId],
  );
  if (r) {
    await oppdater("vurderingsresultat", r.id, {
      ...(r.slettet ? { skalaverdi_id: null, slettet: null } : {}),
      ...ut,
    });
  } else {
    await settInn("vurderingsresultat", {
      vurdering_id: vurderingId,
      elev_id: elevId,
      ...ut,
    });
  }
  if (felter.skalaverdiId !== undefined || felter.leveranse !== undefined)
    varsleVurderinger();
}

// ----------------------------------------------------- tidligere i faget

export type Tidligere = {
  vurderinger: { tittel: string; dato: string | null; kode: string }[];
  /** gronn | gul | rod, eldste først */
  innsats: (string | null)[];
};

/**
 * Det faglige om eleven i faget (28.3): andre vurderinger og innsatsen de
 * siste fire øktene. Aldri mentorsamtaler eller notater fra dem.
 */
export async function hentTidligere(
  elevId: string,
  skolearFagId: string,
  unntatt: string,
): Promise<Tidligere> {
  const [vurderinger, innsats] = await Promise.all([
    hent<{ tittel: string; dato: string | null; kode: string }>(
      `SELECT v.tittel, v.frist AS dato, sv.kode
         FROM vurderingsresultat r
         JOIN vurdering v ON v.id = r.vurdering_id AND v.slettet IS NULL
         JOIN skalaverdi sv ON sv.id = r.skalaverdi_id
        WHERE r.elev_id = $1 AND v.skolear_fag_id = $2 AND v.id <> $3
          AND r.slettet IS NULL AND sv.teller_ikke = 0
        ORDER BY v.frist DESC LIMIT 4`,
      [elevId, skolearFagId, unntatt],
    ),
    hent<{ farge: string | null }>(
      `SELECT sv.farge FROM skaring s
         JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
         JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
        WHERE s.elev_id = $1 AND o.skolear_fag_id = $2
          AND s.slettet IS NULL AND sv.teller_ikke = 0
        ORDER BY o.dato DESC, o.klokkeslett DESC LIMIT 4`,
      [elevId, skolearFagId],
    ),
  ]);
  return { vurderinger, innsats: innsats.map((i) => i.farge).reverse() };
}
