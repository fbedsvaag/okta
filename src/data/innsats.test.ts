import { describe, expect, it } from "vitest";
import { mandagFor, ukesfarge } from "./dashbord";

describe("ukesfarge", () => {
  it("gir trafikklysets fem trinn etter andelen grønt, gult halvt", () => {
    expect(ukesfarge({ gronn: 9, gul: 1, rod: 0 })).toBe("gronn");
    expect(ukesfarge({ gronn: 6, gul: 2, rod: 2 })).toBe("gronngul");
    expect(ukesfarge({ gronn: 3, gul: 3, rod: 4 })).toBe("gul");
    expect(ukesfarge({ gronn: 1, gul: 2, rod: 7 })).toBe("oransje");
    expect(ukesfarge({ gronn: 0, gul: 1, rod: 9 })).toBe("rod");
  });

  it("har ingen farge for en uke uten skåringer", () => {
    expect(ukesfarge({ gronn: 0, gul: 0, rod: 0 })).toBeNull();
  });
});

describe("mandagFor", () => {
  it("finner mandagen, også over nyttår", () => {
    expect(mandagFor("2026-09-30")).toBe("2026-09-28");
    expect(mandagFor("2027-01-03")).toBe("2026-12-28");
  });
});
