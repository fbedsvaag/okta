import { describe, expect, it } from "vitest";
import {
  bandFra,
  panel,
  startplass,
  steg,
  STANDARDKREFTER,
} from "./relasjoner";
import type { Oppsett } from "./klassekart";
import type { Onske } from "./onsker";

const rad = (elevId: string, gruppe: number | null, plass: number | null) => ({
  elevId,
  gruppe,
  plass,
  gruppenavn: null,
  last: false,
});
const o = (rader: Oppsett["rader"]): Oppsett => ({
  id: "x",
  tid: "2026-10-01",
  navn: null,
  rader,
});
const onske = (a: string, b: string, kilde = "eleven"): Onske => ({
  id: a + b,
  elevId: a,
  onskerElevId: b,
  kilde: kilde as Onske["kilde"],
  dato: "2026-10-01",
  samtaleId: null,
});

describe("relasjonskartet (26.9–26.10)", () => {
  const band = bandFra([
    {
      type: "gruppe",
      o: o([rad("a", 0, null), rad("b", 0, null), rad("c", 1, null)]),
      makkerpar: new Set(),
    },
    {
      type: "plass",
      o: o([rad("a", null, 1), rad("c", null, 2), rad("b", null, 3)]),
      makkerpar: new Set(["1|2"]),
    },
  ]);

  it("teller grupper og sidemann per par", () => {
    expect(band).toEqual([
      { a: "a", b: "b", grupper: 1, sidemann: 0 },
      { a: "a", b: "c", grupper: 0, sidemann: 1 },
    ]);
  });

  it("panelet: gjensidige, ikke oppfylt, færrest og ikke nevnt", () => {
    const p = panel({
      elever: ["a", "b", "c", "d"].map((id) => ({
        id,
        fornavn: id,
        etternavn: "",
      })),
      band,
      onsker: [onske("a", "b", "samtale"), onske("b", "a"), onske("c", "d")],
    });
    expect(p.gjensidige).toEqual([["a", "b"]]);
    expect(p.ikkeOppfylt).toEqual([["c", "d"]]);
    expect(p.ferrest[0]).toEqual({ id: "d", antall: 0 });
    expect(p.ikkeNevnt).toEqual(["b", "c", "d"]);
  });

  it("simuleringen faller til ro og holder bundne nærmere enn ubundne", () => {
    const fjaer = [{ a: 0, b: 1, vekt: 3 }];
    const p = startplass(6, fjaer, STANDARDKREFTER);
    const d = (i: number, j: number) =>
      Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y);
    expect(d(0, 1)).toBeLessThan(d(2, 3));
    let alfa = 0.3;
    for (let i = 0; i < 600; i++) alfa = steg(p, fjaer, STANDARDKREFTER, alfa);
    expect(alfa).toBeLessThan(0.004);
  });
});
