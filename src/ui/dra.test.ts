import { describe, expect, it } from "vitest";
import { finnMal, forskyvning, nyPlass } from "./dra";

// Fire rader à 40 px i én gruppe: 0–40, 40–80, 80–120, 120–160.
const rader = [0, 1, 2, 3].map((nr) => ({
  gruppe: 0,
  nr,
  a: nr * 40,
  b: nr * 40 + 40,
}));
const fra = { gruppe: 0, nr: 0 };

describe("finnMal", () => {
  it("lar naboen stå til kortet dekker 30 % av den", () => {
    // 11 px ned dekker 11/40 < 30 % av rad 1.
    expect(finnMal(rader, fra, 11)).toMatchObject({ nr: 1, etter: false });
    // 13 px dekker over 30 %: kortet er forbi rad 1.
    expect(finnMal(rader, fra, 13)).toMatchObject({ nr: 2, etter: false });
  });

  it("havner etter den siste når kortet er dratt forbi alle", () => {
    expect(finnMal(rader, fra, 400)).toMatchObject({ nr: 3, etter: true });
  });

  it("bytter med det det står over når gruppa er full", () => {
    const to = [
      { gruppe: 0, nr: 0, a: 0, b: 40 },
      { gruppe: 1, nr: 0, a: 100, b: 140 },
    ];
    expect(finnMal(to, fra, 100, (g) => g === 1)).toMatchObject({
      gruppe: 1,
      nr: 0,
      bytt: true,
    });
  });

  it("virker likt vannrett, med ulike lengder", () => {
    // Feltene i tidslinjen: 0–100, 100–130, 130–190.
    const felt = [
      { gruppe: 0, nr: 0, a: 0, b: 100 },
      { gruppe: 0, nr: 1, a: 100, b: 130 },
      { gruppe: 0, nr: 2, a: 130, b: 190 },
    ];
    expect(finnMal(felt, fra, 8)).toMatchObject({ nr: 1 });
    expect(finnMal(felt, fra, 40)).toMatchObject({ nr: 2 });
  });
});

describe("nyPlass", () => {
  it("regner om til plassen i lista etter at det dratte er tatt ut", () => {
    expect(
      nyPlass(fra, { gruppe: 0, nr: 2, etter: false, bytt: false }),
    ).toEqual({ gruppe: 0, nr: 1 });
    expect(
      nyPlass(
        { gruppe: 0, nr: 3 },
        { gruppe: 0, nr: 1, etter: false, bytt: false },
      ),
    ).toEqual({
      gruppe: 0,
      nr: 1,
    });
    expect(
      nyPlass(fra, { gruppe: 0, nr: 3, etter: true, bytt: false }),
    ).toEqual({
      gruppe: 0,
      nr: 3,
    });
  });
});

describe("forskyvning", () => {
  it("lar radene mellom glir en plass opp", () => {
    const mal = { gruppe: 0, nr: 2, etter: true, bytt: false };
    expect(forskyvning(rader, fra, mal, { gruppe: 0, nr: 1 })).toBe(-40);
    expect(forskyvning(rader, fra, mal, { gruppe: 0, nr: 2 })).toBe(-40);
    expect(forskyvning(rader, fra, mal, { gruppe: 0, nr: 3 })).toBe(0);
  });

  it("flytter så langt det dratte er langt, når feltene er ulike", () => {
    const felt = [
      { gruppe: 0, nr: 0, a: 0, b: 100 },
      { gruppe: 0, nr: 1, a: 102, b: 132 },
    ];
    const mal = { gruppe: 0, nr: 1, etter: true, bytt: false };
    expect(forskyvning(felt, fra, mal, { gruppe: 0, nr: 1 })).toBe(-102);
  });

  it("står stille når de bytter plass", () => {
    const mal = { gruppe: 0, nr: 2, etter: false, bytt: true };
    expect(forskyvning(rader, fra, mal, { gruppe: 0, nr: 1 })).toBe(0);
  });
});
