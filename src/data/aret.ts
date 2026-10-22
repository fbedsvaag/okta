import { hent, Transaksjon } from "../db";
import { varsle } from "./endringer";
import type { Fridag } from "./kalender";
import type { Okt } from "./okter";
import { PERIODEFARGER } from "./perioder";

/**
 * Skoleåret i ett fag (ARBEIDSLISTE 20.6, lerretet Arsplanlegger).
 *
 * Året er én stripe av plasser: øktene i faget i rekkefølge, og ferier der
 * faget ellers ville hatt økter. Enheten er økter, ikke uker.
 *
 * Perioden står på økta (SPEC §3.3). En periode i stripa er spennet fra
 * første til siste økt som har den; å dra den er å gi øktene i det nye
 * spennet perioden og ta den fra øktene som falt utenfor. Perioder kan
 * ikke overlappe: en ende som dras inn i naboen, flytter grensen, og en
 * periode som flyttes, stopper mot naboene.
 */

export type Plass =
  | { slag: "okt"; dato: string; okt: Okt }
  | { slag: "ferie"; dato: string; navn: string };

const dag = (dato: string) => new Date(`${dato}T12:00:00`).getDay();

function* datoer(fra: string, til: string): Generator<string> {
  const d = new Date(`${fra}T12:00:00`);
  const slutt = new Date(`${til}T12:00:00`);
  while (d <= slutt) {
    yield d.toLocaleDateString("sv-SE");
    d.setDate(d.getDate() + 1);
  }
}

/**
 * Stripa: øktene i faget, sortert, og en ferieplass for hver dag i en ferie
 * der faget pleier å ha økt (ukedagene faget har økter på), innenfor årets
 * første og siste økt.
 */
export function lagStripe(
  okter: Okt[],
  fridager: Fridag[],
  /** ukedagene satt i faginnstillingene (1 = mandag, 29.2); ellers fra øktene */
  fagetsDager?: number[] | null,
): Plass[] {
  const sortert = [...okter].sort(
    (a, b) =>
      a.dato.localeCompare(b.dato) ||
      (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
  );
  if (sortert.length === 0) return [];
  const ukedager = new Set(
    fagetsDager?.length
      ? fagetsDager.map((d) => d % 7)
      : sortert.map((o) => dag(o.dato)),
  );
  const medOkt = new Set(sortert.map((o) => o.dato));
  const forste = sortert[0].dato;
  const siste = sortert[sortert.length - 1].dato;

  const ferier: Plass[] = [];
  for (const f of fridager) {
    if (f.type !== "ferie") continue;
    const fra = f.fra < forste ? forste : f.fra;
    const til = f.til > siste ? siste : f.til;
    for (const d of datoer(fra, til))
      if (ukedager.has(dag(d)) && !medOkt.has(d))
        ferier.push({ slag: "ferie", dato: d, navn: f.navn });
  }

  const plasser: Plass[] = [
    ...sortert.map((okt) => ({ slag: "okt" as const, dato: okt.dato, okt })),
    ...ferier,
  ];
  // Stabil sortering på dato: øktene samme dag står i klokkeslettrekkefølge.
  return plasser.sort((a, b) => a.dato.localeCompare(b.dato));
}

export type Spenn = { fra: number; til: number; antall: number };

/** Hver periodes spenn i stripa: første og siste plass med en av øktene. */
export function spennene(stripe: Plass[]): Map<string, Spenn> {
  const ut = new Map<string, Spenn>();
  stripe.forEach((p, i) => {
    if (p.slag !== "okt" || !p.okt.periodeId) return;
    const s = ut.get(p.okt.periodeId);
    if (!s) ut.set(p.okt.periodeId, { fra: i, til: i, antall: 1 });
    else {
      s.til = i;
      s.antall++;
    }
  });
  return ut;
}

/** Antall økter (ikke ferier) fra og med `fra` til og med `til`. */
export function oktertall(stripe: Plass[], fra: number, til: number): number {
  let n = 0;
  for (let i = Math.max(0, fra); i <= til && i < stripe.length; i++)
    if (stripe[i].slag === "okt") n++;
  return n;
}

/** Nærmeste økt fra `i` i retningen; start og slutt ligger aldri i en ferie. */
export function tilOkt(stripe: Plass[], i: number, retning: 1 | -1): number {
  let j = Math.max(0, Math.min(stripe.length - 1, i));
  while (j >= 0 && j < stripe.length && stripe[j].slag !== "okt") j += retning;
  if (j < 0 || j >= stripe.length) return tilOkt(stripe, i, -retning as 1 | -1);
  return j;
}

/**
 * Hvor langt perioden kan gå før den treffer en nabo: plassen etter
 * forrige periodes slutt og før nesteperiodes start.
 */
export function grenser(
  spenn: Map<string, Spenn>,
  periodeId: string | null,
  ved: number,
  lengde: number,
): { min: number; maks: number } {
  let min = 0;
  let maks = lengde - 1;
  for (const [id, s] of spenn) {
    if (id === periodeId) continue;
    if (s.til < ved) min = Math.max(min, s.til + 1);
    if (s.fra > ved) maks = Math.min(maks, s.fra - 1);
  }
  return { min, maks };
}

export type Endring = { oktId: string; fra: string | null; til: string | null };

/**
 * Endringene som gir perioden nøyaktig øktene i [fra, til]: øktene i spennet
 * får perioden (også fra en nabo), og øktene den hadde utenfor, blir uten.
 */
export function nyFordeling(
  stripe: Plass[],
  periodeId: string,
  fra: number,
  til: number,
): Endring[] {
  const ut: Endring[] = [];
  stripe.forEach((p, i) => {
    if (p.slag !== "okt") return;
    const inne = i >= fra && i <= til;
    const har = p.okt.periodeId === periodeId;
    if (inne && !har)
      ut.push({ oktId: p.okt.id, fra: p.okt.periodeId, til: periodeId });
    else if (!inne && har)
      ut.push({ oktId: p.okt.id, fra: periodeId, til: null });
  });
  return ut;
}

/** Endringene baklengs, til angre. */
export function baklengs(endringer: Endring[]): Endring[] {
  return endringer.map((e) => ({ oktId: e.oktId, fra: e.til, til: e.fra }));
}

/**
 * Lagrer endringene i én transaksjon, og setter `start`/`slutt` på
 * periodene som ble berørt etter øktene de har etterpå. En periode uten
 * økter får tomt spenn: den er ikke lagt inn på året.
 */
export async function tildel(
  endringer: Endring[],
  stripe: Plass[],
): Promise<void> {
  if (endringer.length === 0) return;
  const t = new Transaksjon();
  const ny = new Map(endringer.map((e) => [e.oktId, e.til]));
  for (const e of endringer) t.oppdater("okt", e.oktId, { periode_id: e.til });

  const berorte = new Set(
    endringer.flatMap((e) => [e.fra, e.til]).filter((x): x is string => !!x),
  );
  for (const id of berorte) {
    const datoer = stripe
      .filter(
        (p): p is Extract<Plass, { slag: "okt" }> =>
          p.slag === "okt" &&
          (ny.has(p.okt.id) ? ny.get(p.okt.id) : p.okt.periodeId) === id,
      )
      .map((p) => p.dato);
    t.oppdater("periode", id, {
      start: datoer[0] ?? null,
      slutt: datoer[datoer.length - 1] ?? null,
    });
  }
  await t.kjor();
  varsle();
}

/** Ny periode med navn og farge, uten økter ennå. Gir id-en. */
export async function nyPeriode(
  skolearFagId: string,
  navn: string,
  farge: string | null,
): Promise<string> {
  const [{ n, maks }] = await hent<{ n: number; maks: number | null }>(
    `SELECT COUNT(*) AS n, MAX(rekkefolge) AS maks FROM periode
      WHERE skolear_fag_id = $1`,
    [skolearFagId],
  );
  const t = new Transaksjon();
  const id = t.settInn("periode", {
    skolear_fag_id: skolearFagId,
    navn,
    rekkefolge: (maks ?? 0) + 1,
    farge: farge ?? PERIODEFARGER[n % PERIODEFARGER.length],
  });
  await t.kjor();
  return id;
}
