import { describe, expect, it } from "vitest";
import {
  endringstekst,
  erFerieuke,
  faginnsats,
  maneder,
  skoleuker,
} from "./innsatsuker";
import type { Oktrad } from "./oktrader";

function rad(
  dato: string,
  farge: string | null,
  borte = 0,
  oktId = dato,
  f = "f",
): Oktrad {
  return {
    elevId: "e",
    skolearFagId: f,
    oktId,
    dato,
    klokkeslett: null,
    varighetMin: 90,
    tema: null,
    farge,
    borte,
    ikkeSett: 0,
  };
}

/** n rader i en uke: g grønne, y gule, r røde, o ikke i økta. */
function uke(
  dato: string,
  g: number,
  y: number,
  r: number,
  o: number,
): Oktrad[] {
  return [
    ...Array(g)
      .fill(0)
      .map(() => rad(dato, "gronn")),
    ...Array(y)
      .fill(0)
      .map(() => rad(dato, "gul")),
    ...Array(r)
      .fill(0)
      .map(() => rad(dato, "rod")),
    ...Array(o)
      .fill(0)
      .map(() => rad(dato, null, 1)),
  ];
}

describe("skoleukene", () => {
  it("går fra uka skolen starter til uka den slutter", () => {
    const m = skoleuker("2026-08-19", "2026-09-07");
    expect(m).toEqual(["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"]);
  });

  it("er ferie når alle fem dagene er fri, ikke når det bare er en hendelse", () => {
    const fri = [
      {
        id: "1",
        skolearId: "s",
        navn: "Høstferie",
        type: "ferie" as const,
        fra: "2026-10-05",
        til: "2026-10-09",
      },
      {
        id: "2",
        skolearId: "s",
        navn: "Eksamen",
        type: "hendelse" as const,
        fra: "2026-10-12",
        til: "2026-10-16",
      },
    ];
    expect(erFerieuke("2026-10-05", fri, new Map())).toBe(true);
    expect(erFerieuke("2026-10-12", fri, new Map())).toBe(false);
    expect(erFerieuke("2026-09-28", fri, new Map())).toBe(false);
  });

  it("navngir månedene etter torsdagen i uka", () => {
    expect(
      maneder(["2026-08-24", "2026-08-31", "2026-09-07"]).map((m) => [
        m.navn,
        m.uker,
      ]),
    ).toEqual([
      ["aug", 1],
      ["sep", 2],
    ]);
  });
});

describe("faginnsats", () => {
  const mandager = skoleuker("2026-08-17", "2026-10-30");

  it("stabler hver uke og merker ferie, denne uka og ukene som kommer", () => {
    const rader = [
      ...uke("2026-08-18", 6, 2, 1, 1),
      ...uke("2026-10-13", 3, 0, 0, 0),
    ];
    const f = faginnsats(
      rader,
      "f",
      mandager,
      new Set(["2026-10-05"]),
      "2026-10-14",
    );
    const s = (m: string) => f.uker.find((u) => u.mandag === m)!;
    expect(s("2026-08-17")).toMatchObject({
      status: "data",
      g: 6,
      y: 2,
      r: 1,
      o: 1,
      okter: 1,
    });
    expect(s("2026-08-24").status).toBe("tom");
    expect(s("2026-10-05").status).toBe("ferie");
    expect(s("2026-10-12")).toMatchObject({ status: "data", na: true });
    expect(s("2026-10-19").status).toBe("kommer");
  });

  it("regner andel grønn de siste fire ukene med økter, uten ikke i økta", () => {
    const rader = [
      ...uke("2026-08-18", 1, 1, 0, 0), // før de fire siste
      ...uke("2026-08-25", 3, 1, 0, 9),
      ...uke("2026-09-01", 3, 1, 0, 0),
      ...uke("2026-09-15", 3, 1, 0, 0), // uka 7.9 har ingen økter og hoppes over
      ...uke("2026-09-22", 3, 1, 0, 0),
    ];
    const f = faginnsats(rader, "f", mandager, new Set(), "2026-10-01");
    expect(f.siste).toBe(0.75);
    expect(f.endring).toBe(25); // 75 % mot 50 %
  });

  it("har ingen endring uten fire uker før", () => {
    const f = faginnsats(
      uke("2026-08-18", 1, 1, 0, 0),
      "f",
      mandager,
      new Set(),
      "2026-09-01",
    );
    expect(f.siste).toBe(0.5);
    expect(f.endring).toBeNull();
  });

  it("tar ikke med skåringer etter i dag eller i andre fag", () => {
    const rader = [
      ...uke("2026-09-30", 2, 0, 0, 0),
      rad("2026-09-01", "rod", 0, "x", "annet"),
    ];
    const f = faginnsats(rader, "f", mandager, new Set(), "2026-09-15");
    expect(f.siste).toBeNull();
  });

  it("skriver endringen med pil", () => {
    expect(endringstekst(-3)).toBe("↓ 3 poeng mot fire uker før");
    expect(endringstekst(4)).toBe("↑ 4 poeng mot fire uker før");
    expect(endringstekst(0)).toBe("0 poeng mot fire uker før");
  });
});
