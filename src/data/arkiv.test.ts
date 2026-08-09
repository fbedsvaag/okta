import { describe, expect, it } from "vitest";
import { csv, slugg, tab } from "./arkiv";

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
