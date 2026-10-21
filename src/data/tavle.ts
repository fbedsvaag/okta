import { hent, Transaksjon } from "../db";
import type { Endring, Plass } from "./aret";
import { varsle } from "./endringer";
import { BYTTEFELT, type Okt } from "./okter";
import type { Periode } from "./perioder";

/**
 * Skoleåret som tavle (ARBEIDSLISTE 21.1, lerretet ArsTavle): én kolonne
 * per periode, i den rekkefølgen øktene har dem, og et kort per økt.
 *
 * Perioden står på økta (SPEC §3.3), så kolonnene er bare øktene i
 * rekkefølge, delt der perioden skifter. Økter uten periode blir sin egen
 * kolonne. En ferie står som en linje før økta som kommer etter den.
 */

export type Kortplass =
  { slag: "okt"; okt: Okt; nr: number } | { slag: "ferie"; navn: string };

export type Kolonne = {
  periode: Periode | null;
  plasser: Kortplass[];
  okter: Okt[];
};

export function kolonner(stripe: Plass[], perioder: Periode[]): Kolonne[] {
  const perId = new Map(perioder.map((p) => [p.id, p]));
  const ut: Kolonne[] = [];
  let ferie: string | null = null;
  let nr = 0;
  for (const p of stripe) {
    if (p.slag === "ferie") {
      ferie = p.navn;
      continue;
    }
    const periode = (p.okt.periodeId && perId.get(p.okt.periodeId)) || null;
    let kol = ut[ut.length - 1];
    if (!kol || (kol.periode?.id ?? null) !== (periode?.id ?? null)) {
      kol = { periode, plasser: [], okter: [] };
      ut.push(kol);
    }
    if (ferie) kol.plasser.push({ slag: "ferie", navn: ferie });
    ferie = null;
    kol.plasser.push({ slag: "okt", okt: p.okt, nr: nr++ });
    kol.okter.push(p.okt);
  }
  return ut;
}

/** Feltene som flytter med temaet. Perioden står: den er kolonnen. */
const FELT = BYTTEFELT.filter((f) => f !== "periode_id");

/**
 * Hvor innholdet i hver plass kommer fra når kortet på `fra` slippes på
 * `til`: de to bytter, økt for økt, som i Økter-lista (16.4).
 */
export function kilder(fra: number, til: number): Map<number, number> {
  return new Map([
    [til, fra],
    [fra, til],
  ]);
}

/**
 * Bytter innholdet i øktene på plass `fra` og `til` i rekka (øktene i
 * faget, i rekkefølge). Tema, agenda, plan, lekse, kladd, kompetansemål
 * og vurderinger bytter; en frist som sto på den gamle dagen, følger med
 * til den nye. Perioden står: på tavla er den kolonnen. Skårede økter
 * ligger fast: da skjer ingenting, og svaret er false. Et bytte er sitt
 * eget motsatte.
 */
export async function byttInnhold(
  rekke: Okt[],
  fra: number,
  til: number,
): Promise<boolean> {
  if (fra === til) return false;
  const spenn = [rekke[fra], rekke[til]];
  if (spenn.some((o) => o.skaret > 0)) return false;
  const ider = spenn.map((o) => o.id);
  const plass = ider.map((_, i) => `$${i + 1}`).join(", ");

  const rader = await hent<Record<string, unknown> & { id: string }>(
    `SELECT id, ${FELT.join(", ")} FROM okt WHERE id IN (${plass})`,
    ider,
  );
  const mal = await hent<{ okt: string; kode: string }>(
    `SELECT okt_id AS okt, kode FROM okt_kompetansemal
      WHERE okt_id IN (${plass}) AND slettet IS NULL`,
    ider,
  );
  const vurd = await hent<{ okt: string; v: string; frist: string | null }>(
    `SELECT vo.okt_id AS okt, vo.vurdering_id AS v, vu.frist
       FROM vurdering_okt vo JOIN vurdering vu ON vu.id = vo.vurdering_id
      WHERE vo.okt_id IN (${plass}) AND vo.slettet IS NULL`,
    ider,
  );
  const rad = new Map(rader.map((r) => [r.id, r]));
  const malFor = (id: string) =>
    mal.filter((m) => m.okt === id).map((m) => m.kode);
  const vurdFor = (id: string) => vurd.filter((x) => x.okt === id);

  const t = new Transaksjon();
  const malEndr: { okt: string; kode: string; pa: boolean }[] = [];
  const vurdEndr: { okt: string; v: string; pa: boolean }[] = [];
  const frister = new Map<string, string>();
  for (const [i, k] of kilder(fra, til)) {
    const mot = rekke[i];
    const kilde = rekke[k];
    const r = rad.get(kilde.id);
    if (r)
      t.oppdater(
        "okt",
        mot.id,
        Object.fromEntries(FELT.map((f) => [f, r[f] ?? null])),
      );

    const nyeMal = malFor(kilde.id);
    const gamleMal = malFor(mot.id);
    for (const m of gamleMal.filter((m) => !nyeMal.includes(m)))
      malEndr.push({ okt: mot.id, kode: m, pa: false });
    for (const m of nyeMal.filter((m) => !gamleMal.includes(m)))
      malEndr.push({ okt: mot.id, kode: m, pa: true });

    const nyeV = vurdFor(kilde.id);
    const gamleV = vurdFor(mot.id).map((x) => x.v);
    for (const v of gamleV.filter((v) => !nyeV.some((x) => x.v === v)))
      vurdEndr.push({ okt: mot.id, v, pa: false });
    for (const x of nyeV) {
      if (!gamleV.includes(x.v))
        vurdEndr.push({ okt: mot.id, v: x.v, pa: true });
      if (x.frist === kilde.dato) frister.set(x.v, mot.dato);
    }
  }
  for (const [v, frist] of frister) t.oppdater("vurdering", v, { frist });
  await t.kjor();

  // Kompetansemål og vurderinger har unike nøkler også over slettede rader;
  // de slås av og på, ikke flyttes (som i byttOkter). Av først, så på.
  const { settOktmal } = await import("./perioder");
  const { knyttOkt, losOkt } = await import("./vurderinger");
  for (const e of malEndr.filter((e) => !e.pa))
    await settOktmal(e.okt, e.kode, false);
  for (const e of vurdEndr.filter((e) => !e.pa)) await losOkt(e.v, e.okt);
  for (const e of malEndr.filter((e) => e.pa))
    await settOktmal(e.okt, e.kode, true);
  for (const e of vurdEndr.filter((e) => e.pa)) await knyttOkt(e.v, e.okt);
  varsle();
  return true;
}

/**
 * Kortet (økta) slippes på kolonnen `mal`, som må være naboen til kolonnen
 * det står i — ellers ville periodene overlappe. Kortet og øktene mellom
 * det og målkolonnen får målkolonnens periode, eller ingen når målet er
 * grått. Gir endringene til `tildel`, eller null når det ikke går.
 */
export function tilKolonne(
  kol: Kolonne[],
  oktId: string,
  mal: number,
): Endring[] | null {
  const fra = kol.findIndex((k) => k.okter.some((o) => o.id === oktId));
  if (fra < 0 || Math.abs(mal - fra) !== 1) return null;
  const okter = kol[fra].okter;
  const i = okter.findIndex((o) => o.id === oktId);
  const flyttes = mal < fra ? okter.slice(0, i + 1) : okter.slice(i);
  const til = kol[mal].periode?.id ?? null;
  return flyttes.map((o) => ({ oktId: o.id, fra: o.periodeId, til }));
}
