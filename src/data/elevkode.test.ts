import { describe, expect, it } from "vitest";
import { lagElevkode } from "./elevkode";

const tom = new Set<string>();

describe("elevkode", () => {
  it("er initialer pluss fem sifre", () => {
    expect(lagElevkode("Tony", "Soprano", tom)).toMatch(/^TS\d{5}$/);
  });

  it("tåler navn uten etternavn", () => {
    expect(lagElevkode("Madonna", "", tom)).toMatch(/^MX\d{5}$/);
  });

  it("tåler norske bokstaver", () => {
    expect(lagElevkode("Åse", "Øien", tom)).toMatch(/^ÅØ\d{5}$/);
  });

  it("hopper over tegn som ikke er bokstaver", () => {
    expect(lagElevkode("'Ndrangheta", "La Cerva", tom)).toMatch(/^NL\d{5}$/);
  });

  it("gir aldri en kode som er tatt", () => {
    const opptatt = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const kode = lagElevkode("Tony", "Soprano", opptatt);
      expect(opptatt.has(kode)).toBe(false);
      opptatt.add(kode);
    }
    expect(opptatt.size).toBe(300);
  });
});
