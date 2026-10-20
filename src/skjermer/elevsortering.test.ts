import { describe, expect, it } from "vitest";
import { innsatsSnitt, nesteSortering, sammenlign } from "./elevsortering";

describe("sortering i Elever", () => {
  it("regner innsats uten borte og uten farge", () => {
    expect(innsatsSnitt(["g", "y", "r", "o", "n"])).toBe(0.5);
    expect(innsatsSnitt(["o"])).toBeNull();
  });

  it("snur retningen, men holder tomme verdier sist", () => {
    const v = [3, null, 1, 2];
    expect([...v].sort((a, b) => sammenlign(a, b, "opp"))).toEqual([
      1,
      2,
      3,
      null,
    ]);
    expect([...v].sort((a, b) => sammenlign(a, b, "ned"))).toEqual([
      3,
      2,
      1,
      null,
    ]);
    expect(
      ["3STB", "3STA", ""].sort((a, b) => sammenlign(a, b, "opp")),
    ).toEqual(["3STA", "3STB", ""]);
  });

  it("starter stigende på en ny kolonne og snur på samme", () => {
    const na = { kolonne: "navn" as const, retning: "opp" as const };
    expect(nesteSortering(na, "navn")).toEqual({
      kolonne: "navn",
      retning: "ned",
    });
    expect(nesteSortering(na, "klasse")).toEqual({
      kolonne: "klasse",
      retning: "opp",
    });
  });
});
