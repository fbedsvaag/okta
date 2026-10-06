import { describe, expect, it } from "vitest";
import {
  fordelGrupper,
  fordelPlasser,
  gruppestorrelser,
  lagTilfeldig,
  naboer,
  type Fordelingselev,
  type Fordelingsplass,
} from "./fordeling";

/** Fem rader med tre dobbeltpulter: 30 plasser, nummerert forfra. */
function rom(rader = 5): Fordelingsplass[] {
  const ut: Fordelingsplass[] = [];
  let nr = 1;
  for (let r = 0; r < rader; r++)
    for (let k = 0; k < 3; k++)
      for (let s = 0; s < 2; s++)
        ut.push({
          nr: nr++,
          x: 130 + k * 280 + s * 100,
          y: 190 + r * 80,
          pult: `${r}-${k}`,
        });
  return ut;
}

function elever(
  n: number,
  f?: (i: number) => Partial<Fordelingselev>,
): Fordelingselev[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    kjonn: null,
    innsats: 0.5,
    ...f?.(i),
  }));
}

const felles = {
  holdFra: [] as [string, string][],
  historikk: new Map<string, number>(),
  modus: "tilfeldig" as const,
  bland: false,
  unnga: false,
  frø: 1,
};

/** Hvem som sitter ved samme pult. */
function pultpar(plass: Map<string, number>, plasser: Fordelingsplass[]) {
  const pult = new Map(plasser.map((p) => [p.nr, p.pult]));
  const per = new Map<string, string[]>();
  for (const [id, nr] of plass)
    per.set(pult.get(nr)!, [...(per.get(pult.get(nr)!) ?? []), id]);
  return [...per.values()].filter((x) => x.length === 2);
}

describe("lagTilfeldig", () => {
  it("gir samme rekke for samme frø, og en annen for et annet", () => {
    const a = lagTilfeldig(42);
    const b = lagTilfeldig(42);
    const c = lagTilfeldig(43);
    const ra = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(ra);
    expect([c(), c(), c()]).not.toEqual(ra);
    expect(ra.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("naboer", () => {
  it("parer plassene ved samme dobbeltpult", () => {
    const n = naboer(rom(1));
    expect(n).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("regner enkeltpulter inntil hverandre på samme rad som naboer", () => {
    const n = naboer([
      { nr: 1, x: 50, y: 30, pult: "a" },
      { nr: 2, x: 150, y: 30, pult: "b" },
      { nr: 3, x: 400, y: 30, pult: "c" },
      { nr: 4, x: 50, y: 110, pult: "d" },
    ]);
    expect(n).toEqual([[1, 2]]);
  });
});

describe("fordelPlasser", () => {
  it("gir alle en plass, og ingen to samme plass", () => {
    const r = fordelPlasser({
      ...felles,
      elever: elever(28),
      plasser: rom(),
      laste: new Map(),
    });
    expect(r.plass.size).toBe(28);
    expect(new Set(r.plass.values()).size).toBe(28);
    expect(r.utenPlass).toEqual([]);
  });

  it("samme frø gir samme kart, et annet frø et annet", () => {
    const inn = {
      ...felles,
      elever: elever(20),
      plasser: rom(),
      laste: new Map(),
    };
    const a = fordelPlasser(inn);
    const b = fordelPlasser(inn);
    const c = fordelPlasser({ ...inn, frø: 2 });
    expect([...b.plass]).toEqual([...a.plass]);
    expect([...c.plass]).not.toEqual([...a.plass]);
  });

  it("låste elever blir sittende", () => {
    const laste = new Map([
      ["e0", 30],
      ["e5", 1],
    ]);
    for (const frø of [1, 2, 3, 4, 5]) {
      const r = fordelPlasser({
        ...felles,
        frø,
        elever: elever(20),
        plasser: rom(),
        laste,
      });
      expect(r.plass.get("e0")).toBe(30);
      expect(r.plass.get("e5")).toBe(1);
    }
  });

  it("«hold fra hverandre» holdes alltid", () => {
    const holdFra: [string, string][] = [
      ["e0", "e1"],
      ["e2", "e3"],
      ["e4", "e5"],
    ];
    for (const frø of [1, 2, 3, 4, 5, 6, 7, 8]) {
      // Seks elever på tre pulter: tilfeldig ville ofte satt et par sammen.
      const r = fordelPlasser({
        ...felles,
        frø,
        holdFra,
        elever: elever(6),
        plasser: rom(1),
        laste: new Map(),
      });
      for (const par of pultpar(r.plass, rom(1)))
        for (const [a, b] of holdFra)
          expect(par.sort()).not.toEqual([a, b].sort());
      expect(r.brudd.filter((b) => b.regel === "hold")).toEqual([]);
    }
  });

  it("sier fra når to som skal holdes fra hverandre, er låst ved samme pult", () => {
    const r = fordelPlasser({
      ...felles,
      holdFra: [["e0", "e1"]],
      elever: elever(4),
      plasser: rom(1),
      laste: new Map([
        ["e0", 1],
        ["e1", 2],
      ]),
    });
    expect(r.brudd).toContainEqual({ regel: "hold", tekst: "e0|e1" });
  });

  it("blander jenter og gutter ved pultene", () => {
    const e = elever(30, (i) => ({ kjonn: i < 15 ? "j" : "g" }));
    const r = fordelPlasser({
      ...felles,
      bland: true,
      elever: e,
      plasser: rom(),
      laste: new Map(),
    });
    const kj = new Map(e.map((x) => [x.id, x.kjonn]));
    for (const [a, b] of pultpar(r.plass, rom()))
      expect(kj.get(a)).not.toBe(kj.get(b));
    expect(r.brudd.filter((b) => b.regel === "bland")).toEqual([]);
  });

  it("elever uten kjønn er nøytrale", () => {
    const e = elever(6, (i) => ({ kjonn: i === 0 ? "j" : null }));
    const r = fordelPlasser({
      ...felles,
      bland: true,
      elever: e,
      plasser: rom(1),
      laste: new Map(),
    });
    expect(r.brudd).toEqual([]);
  });

  it("Spre setter lav innsats ved siden av høy", () => {
    const e = elever(30, (i) => ({ innsats: i < 15 ? 0 : 1 }));
    const r = fordelPlasser({
      ...felles,
      modus: "spre",
      elever: e,
      plasser: rom(),
      laste: new Map(),
    });
    const ins = new Map(e.map((x) => [x.id, x.innsats]));
    for (const [a, b] of pultpar(r.plass, rom()))
      expect(ins.get(a)).not.toBe(ins.get(b));
  });

  it("Samle setter lav innsats foran", () => {
    const e = elever(30, (i) => ({ innsats: i < 10 ? 0 : 1 }));
    const r = fordelPlasser({
      ...felles,
      modus: "samle",
      elever: e,
      plasser: rom(),
      laste: new Map(),
    });
    const lave = e
      .filter((x) => x.innsats === 0)
      .map((x) => r.plass.get(x.id)!);
    // De ti med lavest innsats på de ti fremste plassene.
    expect(Math.max(...lave)).toBe(10);
  });

  it("unngår dem som har sittet sammen", () => {
    const historikk = new Map([
      ["e0|e1", 1],
      ["e2|e3", 1],
      ["e4|e5", 1],
    ]);
    const r = fordelPlasser({
      ...felles,
      unnga: true,
      historikk,
      elever: elever(6),
      plasser: rom(1),
      laste: new Map(),
    });
    expect(r.brudd).toEqual([]);
  });

  it("sier fra når rommet er for lite", () => {
    const r = fordelPlasser({
      ...felles,
      elever: elever(8),
      plasser: rom(1),
      laste: new Map(),
    });
    expect(r.utenPlass).toHaveLength(2);
    expect(r.brudd[0].regel).toBe("plass");
  });
});

describe("gruppestorrelser", () => {
  it("deler så likt som mulig, de første én større", () => {
    expect(gruppestorrelser(26, 6)).toEqual([5, 5, 4, 4, 4, 4]);
    expect(gruppestorrelser(24, 6)).toEqual([4, 4, 4, 4, 4, 4]);
  });

  it("lar ingen stå alene", () => {
    expect(gruppestorrelser(5, 4)).toEqual([3, 2]);
    expect(gruppestorrelser(3, 3)).toEqual([3]);
    expect(gruppestorrelser(0, 3)).toEqual([]);
  });
});

describe("fordelGrupper", () => {
  it("fordeler alle, i gruppene størrelsene sier", () => {
    const r = fordelGrupper({
      ...felles,
      antall: 6,
      elever: elever(26),
      laste: new Map(),
    });
    expect(r.grupper.map((g) => g.length)).toEqual([5, 5, 4, 4, 4, 4]);
    expect(new Set(r.grupper.flat()).size).toBe(26);
  });

  it("samme frø gir samme grupper", () => {
    const inn = { ...felles, antall: 5, elever: elever(20), laste: new Map() };
    expect(fordelGrupper(inn).grupper).toEqual(fordelGrupper(inn).grupper);
  });

  it("låste blir i gruppa si", () => {
    const r = fordelGrupper({
      ...felles,
      antall: 4,
      elever: elever(16),
      laste: new Map([
        ["e3", 2],
        ["e9", 2],
      ]),
    });
    expect(r.grupper[2]).toContain("e3");
    expect(r.grupper[2]).toContain("e9");
  });

  it("«hold fra hverandre» holdes alltid", () => {
    const holdFra: [string, string][] = [
      ["e0", "e1"],
      ["e0", "e2"],
      ["e1", "e2"],
    ];
    for (const frø of [1, 2, 3, 4, 5]) {
      const r = fordelGrupper({
        ...felles,
        frø,
        holdFra,
        antall: 3,
        elever: elever(9),
        laste: new Map(),
      });
      for (const g of r.grupper)
        expect(
          g.filter((x) => ["e0", "e1", "e2"].includes(x)).length,
        ).toBeLessThanOrEqual(1);
    }
  });

  it("Samle setter likt nivå sammen", () => {
    const e = elever(12, (i) => ({ innsats: [0, 0.5, 1][i % 3] }));
    const r = fordelGrupper({
      ...felles,
      modus: "samle",
      antall: 3,
      elever: e,
      laste: new Map(),
    });
    const ins = new Map(e.map((x) => [x.id, x.innsats]));
    for (const g of r.grupper)
      expect(new Set(g.map((x) => ins.get(x))).size).toBe(1);
  });

  it("Spre gir hver gruppe både lav og høy innsats", () => {
    const e = elever(12, (i) => ({ innsats: [0, 0.5, 1][i % 3] }));
    const r = fordelGrupper({
      ...felles,
      modus: "spre",
      antall: 4,
      elever: e,
      laste: new Map(),
    });
    const ins = new Map(e.map((x) => [x.id, x.innsats]));
    for (const g of r.grupper) {
      const v = g.map((x) => ins.get(x)!);
      expect(Math.max(...v) - Math.min(...v)).toBe(1);
    }
  });

  it("blander kjønn: ingen gruppe av bare ett kjønn, ingen alene", () => {
    const e = elever(16, (i) => ({ kjonn: i % 2 ? "j" : "g" }));
    const r = fordelGrupper({
      ...felles,
      bland: true,
      antall: 4,
      elever: e,
      laste: new Map(),
    });
    const kj = new Map(e.map((x) => [x.id, x.kjonn]));
    for (const g of r.grupper) {
      const j = g.filter((x) => kj.get(x) === "j").length;
      expect(j).toBe(2);
    }
  });

  it("unngår samme grupper som sist", () => {
    const historikk = new Map<string, number>();
    // Sist: e0–e3, e4–e7, e8–e11.
    for (let g = 0; g < 3; g++)
      for (let a = 0; a < 4; a++)
        for (let b = a + 1; b < 4; b++) {
          const x = `e${g * 4 + a}`;
          const y = `e${g * 4 + b}`;
          historikk.set(x < y ? `${x}|${y}` : `${y}|${x}`, 1);
        }
    const r = fordelGrupper({
      ...felles,
      unnga: true,
      historikk,
      // Fire nye grupper på tre: går opp med én fra hver av de gamle.
      antall: 4,
      elever: elever(12),
      laste: new Map(),
    });
    expect(r.brudd).toEqual([]);
  });
});
