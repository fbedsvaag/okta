import { describe, expect, it } from "vitest";
import { gjettKjonn, nesteKjonn } from "./kjonn";
import fornavn from "../data/fornavn.json";

describe("gjettKjonn", () => {
  it("gjetter når navnet nesten bare brukes om ett kjønn", () => {
    expect(gjettKjonn("Anna")).toBe("j");
    expect(gjettKjonn("Sander")).toBe("g");
    expect(gjettKjonn("  TONY ")).toBe("g");
  });

  it("lar navn som brukes om begge stå tomt", () => {
    // Kim: 7,5 % jenter i SSBs tall — under grensen for en gjetning.
    expect((fornavn as Record<string, number>).kim).toBeGreaterThan(0.05);
    expect(gjettKjonn("Kim")).toBeNull();
  });

  it("gjetter ikke navn som ikke står i lista", () => {
    expect(gjettKjonn("Meadow")).toBeNull();
    expect(gjettKjonn("")).toBeNull();
  });

  it("slår opp første ledd i doble navn", () => {
    expect(gjettKjonn("Anna Sofie")).toBe("j");
    expect(gjettKjonn("Sander-Mathias")).toBe("g");
  });

  it("navnelista har bare andeler mellom 0 og 1", () => {
    const verdier = Object.values(fornavn as Record<string, number>);
    expect(verdier.length).toBeGreaterThan(1000);
    expect(verdier.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe("nesteKjonn", () => {
  it("bytter Jente → Gutt → Ikke satt, og bekrefter", () => {
    expect(nesteKjonn({ k: "j", bekreftet: false })).toEqual({
      k: "g",
      bekreftet: true,
    });
    expect(nesteKjonn({ k: "g", bekreftet: true })).toEqual({
      k: null,
      bekreftet: false,
    });
    expect(nesteKjonn({ k: null, bekreftet: false })).toEqual({
      k: "j",
      bekreftet: true,
    });
  });
});
