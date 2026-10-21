import { describe, expect, it } from "vitest";
import { fyllPulter, gruppeorden, PULTFARGER } from "./pultfarger";
import type { Plass } from "./klassekart";

// To kolonner med tre dobbeltpulter: rad 0, 1, 2 forfra.
const plasser: Plass[] = [];
let nr = 1;
for (const y of [0, 100, 200])
  for (const x of [0, 400])
    for (const s of [0, 1])
      plasser.push({
        nr: nr++,
        delId: `${x}-${y}`,
        pult: `${x}-${y}`,
        x: x + s * 100,
        y,
      });

describe("pultfarger (25.11)", () => {
  it("to og to par: pulten foran og bak er én gruppe", () => {
    const f = fyllPulter(plasser, true);
    // venstre kolonne: rad 0 og 1 sammen, rad 2 alene
    const v = (x: number, y: number) =>
      f.get(plasser.find((p) => p.x === x && p.y === y)!.nr);
    expect(v(0, 0)).toBe(v(0, 100));
    expect(v(0, 0)).toBe(v(100, 100));
    expect(v(0, 200)).not.toBe(v(0, 100));
    expect(v(400, 0)).not.toBe(v(0, 0));
    expect(new Set(f.values()).size).toBe(4);
  });

  it("et gruppebord med fire plasser er sin egen gruppe, også i par", () => {
    const fire: Plass[] = [0, 100].flatMap((y, b) =>
      [0, 1, 2, 3].map((s) => ({
        nr: b * 4 + s + 1,
        delId: `g${b}`,
        pult: `g${b}`,
        x: (s % 2) * 100,
        y: y + Math.floor(s / 2) * 50,
      })),
    );
    expect(new Set(fyllPulter(fire, true).values()).size).toBe(2);
  });

  it("hvert bord sin gruppe", () => {
    expect(new Set(fyllPulter(plasser, false).values()).size).toBe(6);
  });

  it("nummereres lesende fra tavla", () => {
    const f = new Map([
      [5, PULTFARGER[2]],
      [1, PULTFARGER[4]],
      [3, PULTFARGER[2]],
    ]);
    expect(gruppeorden(f)).toEqual([PULTFARGER[4], PULTFARGER[2]]);
  });

  it("ingen gruppefarge ligner trafikklyset", () => {
    for (const t of ["#3f9d49", "#d9a92f", "#c04a3d"])
      expect(PULTFARGER).not.toContain(t);
  });
});
