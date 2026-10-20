import { describe, expect, it } from "vitest";
import { delVed, finnTreff, initialer, nesteSkille } from "./elevnavn";

const elev = (fornavn: string, etternavn: string, klasse = "3STB") => ({
  id: `${fornavn}-${etternavn}`,
  fornavn,
  etternavn,
  klasse,
  fag: [],
  skolearFagIder: [],
});

describe("skillet mellom fornavn og etternavn", () => {
  const navn = "Anne Marie van der Berg";

  it("starter der parseren setter det: siste ord", () => {
    expect(delVed(navn, null)).toEqual({
      fornavn: "Anne Marie van der",
      etternavn: "Berg",
    });
  });

  it("Tab flytter skillet mot venstre og rundt", () => {
    const s1 = nesteSkille(navn, null);
    expect(delVed(navn, s1).etternavn).toBe("der Berg");
    const s2 = nesteSkille(navn, s1);
    expect(delVed(navn, s2)).toEqual({
      fornavn: "Anne Marie",
      etternavn: "van der Berg",
    });
    expect(nesteSkille(navn, 1)).toBe(4);
    expect(nesteSkille(navn, 4, true)).toBe(1);
  });

  it("to ord eller komma: Tab gjør det vanlige", () => {
    expect(nesteSkille("Ada Berg", null)).toBeNull();
    expect(nesteSkille("Berg, Anne Marie", null)).toBeNull();
    expect(delVed("Berg, Anne Marie", 1)).toEqual({
      fornavn: "Anne Marie",
      etternavn: "Berg",
    });
  });
});

describe("initialer", () => {
  it("tar fornavnet og siste ord i etternavnet", () => {
    expect(initialer("Anne Marie", "van der Berg")).toBe("AB");
    expect(initialer("ada", "")).toBe("A");
  });
});

describe("duplikatsjekken", () => {
  const alle = [elev("Ida", "Moe"), elev("Christopher", "Moltisanti")];

  it("samme navn finnes, uansett store bokstaver", () => {
    expect(finnTreff("ida", "moe", alle)).toMatchObject({
      slag: "finnes",
      elev: { klasse: "3STB" },
    });
  });

  it("skrivefeil ligner bare", () => {
    expect(finnTreff("Cristopher", "Moltisanti", alle)?.slag).toBe("ligner");
  });

  it("nytt navn gir ingenting", () => {
    expect(finnTreff("Nora", "Vik", alle)).toBeNull();
    expect(finnTreff("Nora", "", alle)).toBeNull();
  });
});
