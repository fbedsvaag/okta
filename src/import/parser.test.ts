import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { delNavn, normalisertNavn, parseListe } from "./parser";

const dummy = (fil: string) =>
  readFileSync(new URL(`../../dummydata/${fil}`, import.meta.url), "utf8");

describe("formatene i SPEC §7", () => {
  it("tåler alle sju skrivemåtene", () => {
    const { elever } = parseListe(
      [
        "Reistad, Anna",
        "Anna Reistad",
        "Anna\tReistad",
        "Anna Reistad;1STC",
        "- Anna Reistad",
        "* Anna Reistad",
        "1. Anna Reistad",
      ].join("\n"),
    );

    expect(elever).toHaveLength(7);
    for (const e of elever) {
      expect(e.fornavn).toBe("Anna");
      expect(e.etternavn).toBe("Reistad");
    }
    expect(elever[3].klasse).toBe("1STC");
  });

  it("hopper over overskrifter og tomme linjer", () => {
    const { elever, hoppetOver } = parseListe(
      "# Klasseliste 1STC\n\nTony Soprano\n\n## Ekstra\nCarmela Soprano\n",
    );

    expect(elever.map((e) => e.fornavn)).toEqual(["Tony", "Carmela"]);
    expect(hoppetOver.map((h) => h.grunn)).toEqual(["overskrift", "overskrift"]);
  });
});

describe("flerdelte etternavn", () => {
  it("slår partikkelen sammen med ordet etter", () => {
    expect(delNavn("Adriana La Cerva")).toEqual({
      fornavn: "Adriana",
      etternavn: "La Cerva",
    });
    expect(delNavn("Richard La Penna").etternavn).toBe("La Penna");
    expect(delNavn("Feech La Manna").etternavn).toBe("La Manna");
    expect(delNavn("Ludwig van Beethoven").etternavn).toBe("van Beethoven");
  });

  it("gir samme svar uansett skrivemåte", () => {
    expect(delNavn("La Cerva, Adriana")).toEqual(delNavn("Adriana La Cerva"));
  });

  it("spiser aldri hele fornavnet", () => {
    // "De" er en partikkel, men her er det alt vi har til fornavn.
    expect(delNavn("De Rossi")).toEqual({ fornavn: "De", etternavn: "Rossi" });
  });
});

describe("skrivemåte", () => {
  it("rører ikke store bokstaver midt i navn", () => {
    expect(delNavn("Finn DeTrolio").etternavn).toBe("DeTrolio");
    expect(delNavn("Ercole DiMeo").etternavn).toBe("DiMeo");
    expect(delNavn("Ralph DeConcini").etternavn).toBe("DeConcini");
    expect(delNavn("Scrooge McDuck").etternavn).toBe("McDuck");
  });

  it("normaliserer bare til sammenlikning, ikke til lagring", () => {
    expect(normalisertNavn("Tony", "Soprano")).toBe("tony soprano");
    expect(normalisertNavn("  Tony ", "Soprano")).toBe("tony soprano");
  });
});

describe("de fire dummylistene", () => {
  const forventet = [
    { fil: "1STC-MFL1.md", antall: 30 },
    { fil: "2STA-MFL2.md", antall: 29 },
    { fil: "1STB-ENG1.md", antall: 28 },
    { fil: "1STA-ENGVG1.md", antall: 29 },
  ];

  for (const { fil, antall } of forventet) {
    it(`${fil} gir ${antall} elever, alle med for- og etternavn`, () => {
      const { elever } = parseListe(dummy(fil));
      expect(elever).toHaveLength(antall);
      for (const e of elever) {
        expect(e.fornavn, `${fil}: ${e.original}`).not.toBe("");
        expect(e.etternavn, `${fil}: ${e.original}`).not.toBe("");
      }
    });
  }

  it("henter klassen ut av 1STA-listen", () => {
    const { elever } = parseListe(dummy("1STA-ENGVG1.md"));
    expect(new Set(elever.map((e) => e.klasse))).toEqual(new Set(["1STA"]));
  });

  it("lar de andre listene stå uten klasse", () => {
    for (const fil of ["1STC-MFL1.md", "2STA-MFL2.md", "1STB-ENG1.md"]) {
      const { elever } = parseListe(dummy(fil));
      expect(elever.every((e) => e.klasse === null), fil).toBe(true);
    }
  });

  it("finner La Cerva og de andre partikkelnavnene", () => {
    const alle = ["1STC-MFL1.md", "2STA-MFL2.md", "1STB-ENG1.md", "1STA-ENGVG1.md"]
      .flatMap((f) => parseListe(dummy(f)).elever)
      .map((e) => e.etternavn);

    for (const navn of ["La Cerva", "La Penna", "La Paz", "La Manna"]) {
      expect(alle, navn).toContain(navn);
    }
  });

  it("holder elever med samme etternavn fra hverandre", () => {
    const { elever } = parseListe(dummy("1STC-MFL1.md"));
    const sopranoer = elever.filter((e) => e.etternavn === "Soprano");
    expect(sopranoer.length).toBeGreaterThan(1);

    // Duplikatsjekken går på hele navnet, ikke på etternavnet alene.
    const navn = new Set(sopranoer.map((e) => normalisertNavn(e.fornavn, e.etternavn)));
    expect(navn.size).toBe(sopranoer.length);
  });
});
