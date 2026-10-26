import { describe, expect, it } from "vitest";
import {
  dagrekkefolge,
  flytt,
  leggUtTidsplan,
  rekkefolgeIDagene,
  type Tidsplandag,
} from "./tidsplan";

const dag = (id: string, dato: string): Tidsplandag =>
  ({
    id,
    dato,
    fra: "08:30",
    til: null,
    oktId: null,
    lunsjFra: null,
    lunsjMin: null,
  }) as unknown as Tidsplandag;

/** Det lagringen skriver, lest tilbake slik lesTidsplan gjør. */
function rundtur(rekke: string[], dager: Tidsplandag[]): string[] {
  const perDag = leggUtTidsplan(rekke, dager, 20, 5).map((d) =>
    d.rader.map((r) => ({ elevId: r.elevId, klokkeslett: r.fra })),
  );
  return rekkefolgeIDagene(perDag).map(({ x }) => x.elevId);
}

describe("rekkefølgen i tidsplanen", () => {
  const elever = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("står når to dager har samme dato", () => {
    const dager = [dag("1", "2026-10-28"), dag("2", "2026-10-28")];
    expect(rundtur(elever, dager)).toEqual(elever);
  });

  it("står når en dag mangler dato", () => {
    const dager = [dag("1", "2026-10-28"), dag("2", "")];
    expect(rundtur(elever, dager)).toEqual(elever);
  });

  it("flytter bare eleven som dras", () => {
    const dager = [dag("1", ""), dag("2", "")];
    const ny = flytt(elever, 1, 3);
    expect(ny).toEqual(["a", "c", "d", "b", "e", "f", "g", "h"]);
    expect(rundtur(ny, dager)).toEqual(ny);
  });

  it("har dagene i fast rekkefølge også ved lik dato", () => {
    const x = { dato: "2026-10-28", fra: "08:30", id: "b" };
    const y = { dato: "2026-10-28", fra: "08:30", id: "a" };
    const uten = { dato: "", fra: "08:30", id: "0" };
    expect([x, uten, y].sort(dagrekkefolge).map((d) => d.id)).toEqual([
      "a",
      "b",
      "0",
    ]);
  });
});
