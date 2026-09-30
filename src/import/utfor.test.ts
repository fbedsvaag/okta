import { describe, expect, it } from "vitest";
import { ikkePaLista, tilImportrader } from "./utfor";
import type { Vurdering } from "./duplikat";

function vurdering(fornavn: string, klasse: string | null): Vurdering {
  return {
    linje: { linjenr: 1, original: fornavn, fornavn, etternavn: "Soprano", klasse },
    status: "ny",
    grunn: "ingen-match",
    kandidater: [],
    valgt: "ny",
    klassekonflikt: null,
  };
}

describe("tilImportrader", () => {
  // Formatet «navn; klasse» er bare til nytte hvis klassen på linja faktisk
  // blir brukt. Parseren finner den; dette er leddet som tar den i bruk.
  it("lar klassen på linja vinne over den som er valgt i forhåndsvisningen", () => {
    const rader = tilImportrader([vurdering("Tony", "3STB")], "1STC");
    expect(rader[0].klasse).toBe("3STB");
  });

  it("bruker den valgte klassen på linjer uten egen klasse", () => {
    const rader = tilImportrader([vurdering("Carmela", null)], "1STC");
    expect(rader[0].klasse).toBe("1STC");
  });

  it("lar eleven stå uten klasse når ingen av delene er oppgitt", () => {
    // Uten klasse er lovlig (§3.2) og skal ikke blokkere importen.
    const rader = tilImportrader([vurdering("Meadow", null)], "");
    expect(rader[0].klasse).toBe("");
  });

  it("blander linjer med og uten egen klasse i samme innliming", () => {
    const rader = tilImportrader(
      [vurdering("Tony", "3STB"), vurdering("Carmela", null)],
      "1STC",
    );
    expect(rader.map((r) => r.klasse)).toEqual(["3STB", "1STC"]);
  });

  it("rører ikke klassen til en eksisterende elev som standard", () => {
    // «Samme elev» legger til fag, ikke klasse (§7.1).
    const rader = tilImportrader([vurdering("Tony", "3STB")], "1STC");
    expect(rader[0].byttKlasse).toBe(false);
    expect(rader[0].hopp).toBe(false);
  });
});

describe("ikkePaLista", () => {
  const rad = (valgt: string, hopp = false) => ({
    ...tilImportrader([vurdering("X", null)], "")[0],
    valgt,
    status: valgt === "ny" ? ("ny" as const) : ("allerede" as const),
    hopp,
  });

  it("gir elevene i faget som ingen linje peker på", () => {
    const rader = [rad("tony"), rad("ny")];
    expect(ikkePaLista(rader, ["tony", "carmela"])).toEqual(["carmela"]);
  });

  it("regner en linje som hoppes over som «ikke på lista»", () => {
    expect(ikkePaLista([rad("tony", true)], ["tony"])).toEqual(["tony"]);
  });
});
