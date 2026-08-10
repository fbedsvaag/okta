import { describe, expect, it } from "vitest";
import { skalategn } from "./farger";

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
