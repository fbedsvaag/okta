import { describe, expect, it } from "vitest";
import { GAMLE, INDEKS, SIDENAVN, sok } from "./sok";

describe("søk i innstillingene (23.3)", () => {
  it("tomt søk gir ingenting", () => {
    expect(sok("")).toEqual([]);
    expect(sok("   ")).toEqual([]);
  });

  it("treffer tittelen, uansett store bokstaver", () => {
    expect(sok("glass").map((x) => x.k)).toContain("glass");
    expect(sok("TEKSTSTØRRELSE")[0]).toMatchObject({
      side: "generelt",
      k: "tekst",
    });
  });

  it("treffer andre ord folk bruker", () => {
    expect(sok("backup")[0]).toMatchObject({ side: "kopi", k: "kopinaa" });
    expect(sok("icloud")[0]).toMatchObject({ side: "kalender", k: "strom" });
    expect(sok("kontaktlærer")[0]).toMatchObject({ side: "deg", k: "mentor" });
  });

  it("treffer sidens navn", () => {
    const k = sok("personvern").map((x) => x.side);
    expect(k).toContain("personvern");
  });

  it("tittel som begynner med søket kommer først", () => {
    const t = sok("pass");
    expect(t[0].tittel.toLowerCase().startsWith("pass")).toBe(true);
  });

  it("tar med ekstra rader, uten doble, og høyst sju", () => {
    const ekstra = [
      { side: "fag" as const, k: "fag-x", tittel: "HIS3 Historie vg3" },
      { side: "fag" as const, k: "fag-x", tittel: "HIS3 Historie vg3" },
    ];
    expect(sok("his3", ekstra)).toHaveLength(1);
    expect(sok("a").length).toBeLessThanOrEqual(7);
  });

  it("hver rad har en side som finnes, og nøklene er unike per side", () => {
    const sett = new Set<string>();
    for (const x of INDEKS) {
      expect(SIDENAVN[x.side]).toBeDefined();
      expect(sett.has(`${x.side}:${x.k}`)).toBe(false);
      sett.add(`${x.side}:${x.k}`);
    }
    for (const s of Object.values(GAMLE)) expect(SIDENAVN[s]).toBeDefined();
  });
});
