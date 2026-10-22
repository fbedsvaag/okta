import { describe, expect, it } from "vitest";
import {
  ALLE_FAGFARGER,
  FAGFARGER,
  ledigFagfarge,
  lignerTrafikklys,
  skalategn,
} from "./farger";

describe("skalategn", () => {
  it("gir sirkler til enkeltskåringer", () => {
    expect(skalategn("gronn", "sirkel")).toBe("🟢");
    expect(skalategn("gul", "sirkel")).toBe("🟡");
    expect(skalategn("rod", "sirkel")).toBe("🔴");
  });

  it("gir kvadrater til den sammenhengende stripa", () => {
    expect(skalategn("gronn", "kvadrat")).toBe("🟩");
    expect(skalategn("gul", "kvadrat")).toBe("🟨");
    expect(skalategn("rod", "kvadrat")).toBe("🟥");
  });

  it("gir eget tegn til verdier uten farge, altså «ikke i økta»", () => {
    expect(skalategn(null, "sirkel")).toBe("⚪");
    expect(skalategn(null, "kvadrat")).toBe("⬜");
    // Tom streng er samme sak — basen kan ha begge deler.
    expect(skalategn("", "sirkel")).toBe("⚪");
  });

  it("gir null for farger uten tegn, så kallstedet skriver ordet", () => {
    // Unicode har ingen grønngul sirkel, og to emoji ved siden av hverandre
    // ville lest som to skåringer.
    expect(skalategn("gronngul", "sirkel")).toBeNull();
    expect(skalategn("lilla", "kvadrat")).toBeNull();
  });

  it("holder de to settene adskilt", () => {
    for (const farge of ["gronn", "gul", "rod", null]) {
      expect(skalategn(farge, "sirkel")).not.toBe(skalategn(farge, "kvadrat"));
    }
  });
});

describe("fagfargene (17.3)", () => {
  it("er 36 ulike, i seks familier à seks", () => {
    expect(Object.keys(FAGFARGER)).toEqual([
      "Jord",
      "Bær",
      "Skog",
      "Hav",
      "Skumring",
      "Klar",
    ]);
    for (const f of Object.values(FAGFARGER)) expect(f).toHaveLength(6);
    expect(new Set(ALLE_FAGFARGER).size).toBe(36);
  });

  it("ingen ligner trafikklyset, og en egen farge som gjør det, fanges", () => {
    for (const f of ALLE_FAGFARGER) expect(lignerTrafikklys(f), f).toBeNull();
    expect(lignerTrafikklys("#3f9d49")).toBe("#3f9d49");
    expect(lignerTrafikklys("#c24b3e")).toBe("#c04a3d");
    expect(lignerTrafikklys("#d5a52c")).toBe("#d9a92f");
    expect(lignerTrafikklys("#1f8ae0")).toBeNull();
  });

  it("et nytt fag får den første ledige", () => {
    expect(ledigFagfarge([])).toBe("#9a5a2c");
    expect(ledigFagfarge(["#9a5a2c", null])).toBe("#b5703a");
  });
});
