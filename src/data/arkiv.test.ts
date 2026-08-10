import { describe, expect, it } from "vitest";
import { csv, slugg, tab, verdimerke } from "./arkiv";

describe("slugg", () => {
  it("skriver om æ, ø og å framfor å prosentkode dem", () => {
    expect(slugg("Kåre Kålrabi")).toBe("kaare-kaalrabi");
    expect(slugg("Ørjan Æsmundsen")).toBe("oerjan-aesmundsen");
  });

  it("beholder flerdelte etternavn som ett filnavn", () => {
    expect(slugg("Adriana La Cerva")).toBe("adriana-la-cerva");
  });

  it("fjerner aksenter og tegn som ikke hører hjemme i et filnavn", () => {
    expect(slugg("Silvio Dantè")).toBe("silvio-dante");
    expect(slugg("O'Brien, Seán")).toBe("o-brien-sean");
  });

  it("etterlater aldri bindestrek i hver ende", () => {
    expect(slugg("  Tony  ")).toBe("tony");
    expect(slugg("MFL1!")).toBe("mfl1");
  });
});

describe("tab", () => {
  it("rømmer rørtegn som ellers ville delt en tabellrad", () => {
    expect(tab("a | b")).toBe("a \\| b");
  });

  it("gjør linjeskift til mellomrom, så raden ikke brekker", () => {
    expect(tab("linje\nto")).toBe("linje to");
  });

  it("tåler null", () => {
    expect(tab(null)).toBe("");
  });
});

describe("csv", () => {
  it("siterer felter med komma, hermetegn eller linjeskift", () => {
    const ut = csv(["a", "b"], [['sa "hei"', "x,y"]]);
    expect(ut).toContain('"sa ""hei"""');
    expect(ut).toContain('"x,y"');
  });

  it("lar vanlige felter stå usitert", () => {
    expect(csv(["a"], [["enkelt"]])).toBe("a\nenkelt\n");
  });
});

describe("verdimerke", () => {
  it("gir farget sirkel etter fargen på skalaverdien", () => {
    expect(verdimerke("Grønn", "gronn", 0)).toBe("🟢 Grønn");
    expect(verdimerke("Gul", "gul", 0)).toBe("🟡 Gul");
    expect(verdimerke("Rød", "rod", 0)).toBe("🔴 Rød");
  });

  it("gir hvit sirkel for verdier uten farge", () => {
    expect(verdimerke("Ikke i økta", null, 1)).toContain("⚪");
  });

  it("merker verdier som ikke teller, så de ikke leses som resultat", () => {
    expect(verdimerke("IV", null, 1)).toContain("*(teller ikke)*");
    expect(verdimerke("Grønn", "gronn", 0)).not.toContain("teller ikke");
  });

  it("beholder kodeteksten ved siden av, så arkivet kan søkes i", () => {
    expect(verdimerke("Rød", "rod", 0)).toContain("Rød");
  });
});

describe("skoleåret som mappenavn", () => {
  it("gjør skråstreken i «2026/27» om, så det ikke blir en undermappe", () => {
    expect(slugg("2026/27")).toBe("2026-27");
    expect(slugg("2026/27")).not.toContain("/");
  });
});
