import type { Ark, Arkbolk, Arkrad } from "./arsplanark";
import { ukenummer } from "./kalender";

/**
 * Årsplanen delt i A4-sider (ARBEIDSLISTE 11.6, lerretet «ArsplanPdf1–3»).
 *
 * WebKit kan ikke sette sidetall, gjentatte tabellhoder eller «fortsetter»
 * selv, så sidene lages her. Radene har fast høyde (lange tekster kuttes
 * med «…»), og da kan inndelingen regnes ut uten å måle annet enn toppen
 * på side 1.
 */

export type Arkelement =
  | { type: "periode"; bolk: Arkbolk; fortsetter: boolean }
  | { type: "rad"; rad: Arkrad }
  | { type: "ferie"; navn: string; uke: number };

export type Side = { elementer: Arkelement[] };

/** Høyder i CSS-px (96 per tomme), som utskriftsvisningen tegner dem. */
export const MAL = {
  rad: 22,
  periode: 40,
  fortsetter: 30,
  kolonnehode: 24,
  /** smal topplinje på side 2 og utover */
  topp: 34,
};

/** Sidens innhold i høyde: A4 minus margene øverst (44) og nederst (70). */
export function innholdshoyde(liggende: boolean): number {
  return (liggende ? 794 : 1123) - 44 - 70;
}

/**
 * Periodene med radene sine, og feriene flettet inn etter dato: en ferie
 * står foran første økt etter at den begynner, i perioden før hvis den
 * økta er den første i en ny periode. Ferier før første eller etter siste
 * økt tas ikke med.
 */
export function bolkerMedFerier(
  ark: Ark,
): { bolk: Arkbolk; elementer: Arkelement[] }[] {
  const ut = ark.bolker.map((bolk) => ({
    bolk,
    elementer: bolk.rader.map((rad): Arkelement => ({ type: "rad", rad })),
  }));
  for (const f of [...ark.ferier].sort((a, b) => a.fra.localeCompare(b.fra))) {
    const ferie: Arkelement = {
      type: "ferie",
      navn: f.navn,
      uke: ukenummer(f.fra),
    };
    let plassert = false;
    for (let b = 0; b < ut.length && !plassert; b++) {
      const i = ut[b].elementer.findIndex(
        (e) => e.type === "rad" && e.rad.dato > f.til,
      );
      if (i < 0) continue;
      if (i === 0) {
        if (b > 0) ut[b - 1].elementer.push(ferie);
      } else ut[b].elementer.splice(i, 0, ferie);
      plassert = true;
    }
  }
  return ut;
}

/**
 * Deler elementene i sider. En periodeoverskrift står aldri alene nederst
 * på en side; fortsetter en periode på en ny side, får den «fortsetter».
 */
export function delISider(
  ark: Ark,
  /** høyden på toppen av side 1 (alt over tabellen), målt */
  forsteTopp: number,
): Side[] {
  const maks = innholdshoyde(ark.liggende);
  const sider: Side[] = [];
  let side: Side = { elementer: [] };
  let brukt = forsteTopp + MAL.kolonnehode;

  const nySide = () => {
    sider.push(side);
    side = { elementer: [] };
    brukt = MAL.topp + MAL.kolonnehode;
  };

  for (const { bolk, elementer } of bolkerMedFerier(ark)) {
    if (bolk.navn) {
      // Overskriften og minst én rad skal stå sammen.
      if (brukt + MAL.periode + MAL.rad > maks && side.elementer.length > 0)
        nySide();
      side.elementer.push({ type: "periode", bolk, fortsetter: false });
      brukt += MAL.periode;
    }
    for (const e of elementer) {
      if (brukt + MAL.rad > maks) {
        nySide();
        if (bolk.navn) {
          side.elementer.push({ type: "periode", bolk, fortsetter: true });
          brukt += MAL.fortsetter;
        }
      }
      side.elementer.push(e);
      brukt += MAL.rad;
    }
  }
  sider.push(side);
  return sider;
}
