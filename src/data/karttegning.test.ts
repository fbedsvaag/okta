import { describe, expect, it } from "vitest";
import { plasserIRom, romMal, type Del } from "./klassekart";
import { gruppeListe, kartListe, kartSvg, kortnavn } from "./karttegning";

const deler: Del[] = romMal("par").map((d, i) => ({ ...d, id: `d${i}` }));
const plasser = plasserIRom(deler);
// Elevene har flere felter enn tegningen trenger: de skal ikke ut.
const elever = [
  { id: "t", fornavn: "Tony", etternavn: "Soprano", kjonn: "g", innsats: 0.13 },
  {
    id: "m",
    fornavn: "Meadow",
    etternavn: "Soprano",
    kjonn: "j",
    innsats: 0.97,
  },
  {
    id: "p",
    fornavn: "Paulie",
    etternavn: "Gualtieri",
    kjonn: "g",
    innsats: 0.5,
  },
];
const plass = new Map([
  ["t", 1],
  ["m", 2],
  ["p", 3],
]);

describe("kortnavn", () => {
  it("gir fornavn og første bokstav i etternavnet", () => {
    expect(kortnavn({ fornavn: "Tony", etternavn: "Soprano" })).toBe("Tony S.");
    expect(kortnavn({ fornavn: "Cher", etternavn: "" })).toBe("Cher");
  });
});

describe("kartListe", () => {
  it("lister pult for pult, forfra", () => {
    const t = kartListe({ tittel: "MFL2 · Rom 214", plasser, plass, elever });
    expect(t.split("\n")).toEqual([
      "MFL2 · Rom 214",
      "",
      "Pult 1: Tony S., Meadow S.",
      "Pult 2: Paulie G.",
    ]);
  });
});

describe("gruppeListe", () => {
  it("bruker gruppenavnet, eller «Gruppe n»", () => {
    const t = gruppeListe({
      tittel: "MFL2",
      grupper: [["t", "m"], ["p"]],
      navn: ["Rød", null],
      elever,
    });
    expect(t).toContain("Rød: Tony S., Meadow S.");
    expect(t).toContain("Gruppe 2: Paulie G.");
  });
});

describe("personvern i det som går ut", () => {
  const svg = kartSvg({
    tittel: "MFL2",
    deler,
    plasser,
    plass,
    elever,
    fraElevene: false,
  });
  const liste = kartListe({ tittel: "MFL2", plasser, plass, elever });

  it("har ikke fulle etternavn, kjønn, innsats eller bilder", () => {
    for (const ut of [svg, liste]) {
      expect(ut).not.toContain("Soprano");
      expect(ut).not.toContain("Gualtieri");
      expect(ut).not.toMatch(/kjonn|kjønn|innsats|0\.13|0\.97/i);
      expect(ut).not.toContain("data:image");
      expect(ut).not.toContain("<image");
      // Ingen innsatsfarge på pultene: verken trafikklyset eller tokens.
      expect(ut).not.toMatch(
        /#3f9d49|#d9a92f|#c04a3d|lys-gronn|lys-gul|lys-rod/i,
      );
    }
    expect(svg).toContain("Tony S.");
  });

  it("snur tegningen fra elevenes side", () => {
    const snudd = kartSvg({
      tittel: "MFL2",
      deler,
      plasser,
      plass,
      elever,
      fraElevene: true,
    });
    expect(snudd).not.toBe(svg);
    expect(snudd).toContain("Tony S.");
  });
});
