import type { Plass } from "./klassekart";

/**
 * Gruppefarger i klassekartet (ARBEIDSLISTE 25.11, lerretet
 * KlassekartFarger). Fargen hører til plassen i rommet, ikke eleven:
 * stokkes plassene, blir fargene stående og elevene får nye grupper.
 *
 * Ingen av fargene ligner trafikklyset (grønn, gul, rød), så en gruppe
 * aldri kan leses som innsats.
 */
export const PULTFARGER = [
  "#4f7ac0",
  "#c9922e",
  "#2f9a8a",
  "#c0607a",
  "#7d6bb0",
  "#5f8a3a",
  "#9a5a2c",
  "#2e6a8e",
];

/**
 * «Fyll ut for meg»: pultene i kolonner fra venstre, forfra (nærmest
 * tavla) og bakover. `par`: pulten foran og bak er én gruppe — to og to par,
 * det vanligste; et gruppebord (fire plasser eller flere) er alltid sin egen.
 * Ellers er hver pult sin gruppe.
 */
export function fyllPulter(
  plasser: Plass[],
  par: boolean,
): Map<number, string> {
  const pulter = new Map<string, { x: number; y: number; nr: number[] }>();
  for (const p of plasser) {
    const d = pulter.get(p.pult) ?? { x: 0, y: 0, nr: [] };
    d.nr.push(p.nr);
    d.x += p.x;
    d.y += p.y;
    pulter.set(p.pult, d);
  }
  const midt = [...pulter.values()].map((d) => ({
    x: d.x / d.nr.length,
    y: d.y / d.nr.length,
    nr: d.nr,
  }));
  // Kolonner: pulter med midtpunkt innenfor en halv pult fra hverandre.
  const kolonner: (typeof midt)[] = [];
  for (const d of [...midt].sort((a, b) => a.x - b.x)) {
    const k = kolonner.find((c) => Math.abs(c[0].x - d.x) < 60);
    if (k) k.push(d);
    else kolonner.push([d]);
  }
  const ut = new Map<number, string>();
  let gruppe = 0;
  for (const k of kolonner) {
    k.sort((a, b) => a.y - b.y);
    // Et bord med fire eller flere plasser er alt en gruppe; bare de små
    // pultene slås sammen to og to.
    let iParet = 0;
    for (const d of k) {
      const stor = d.nr.length >= 4;
      if (iParet > 0 && (!par || stor || iParet === 2)) {
        gruppe++;
        iParet = 0;
      }
      for (const nr of d.nr) ut.set(nr, PULTFARGER[gruppe % PULTFARGER.length]);
      iParet = stor ? 2 : iParet + 1;
    }
    gruppe++;
  }
  return ut;
}

/**
 * Fargene i den rekkefølgen gruppene nummereres: lesende fra tavla, etter
 * den første plassen med fargen (plassene er nummerert forfra, fra venstre).
 */
export function gruppeorden(farger: Map<number, string>): string[] {
  const forste = new Map<string, number>();
  for (const [nr, f] of farger)
    if (!forste.has(f) || nr < forste.get(f)!) forste.set(f, nr);
  return [...forste].sort((a, b) => a[1] - b[1]).map(([f]) => f);
}
