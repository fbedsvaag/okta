import { describe, expect, it } from "vitest";
import { kappOkter, linjerSomFarPlass } from "./Skolekalender";

describe("linjerSomFarPlass", () => {
  it("gir flere linjer når ruta er høyere", () => {
    expect(linjerSomFarPlass(100)).toBeGreaterThan(linjerSomFarPlass(50));
  });

  it("gir alltid minst én linje, uansett hvor lav ruta blir", () => {
    // En rute som ikke viser noe som helst er verre enn en som viser «+3 til».
    expect(linjerSomFarPlass(0)).toBe(1);
    expect(linjerSomFarPlass(-40)).toBe(1);
  });
});

describe("kappOkter", () => {
  // Poenget: alle ruter er like høye. En uke der én dag har fem økter skal
  // ikke gjøre hele måneden uleselig.
  it("lar alt stå når det får plass", () => {
    expect(kappOkter(["a", "b"], 3)).toEqual({
      synlige: ["a", "b"],
      skjulte: 0,
    });
  });

  it("fyller plassen helt ut når det går akkurat opp", () => {
    expect(kappOkter(["a", "b", "c"], 3)).toEqual({
      synlige: ["a", "b", "c"],
      skjulte: 0,
    });
  });

  it("bruker nederste linje til telleren når det ikke går opp", () => {
    // Fire økter på tre linjer: to vises, og telleren sier «+2 til» på den
    // tredje. Telleren skal ikke selv skyve ut en økt i det stille.
    expect(kappOkter(["a", "b", "c", "d"], 3)).toEqual({
      synlige: ["a", "b"],
      skjulte: 2,
    });
  });

  it("teller alle når det bare er plass til én linje", () => {
    expect(kappOkter(["a", "b", "c"], 1)).toEqual({
      synlige: [],
      skjulte: 3,
    });
  });

  it("mister ingen økter — alt er enten synlig eller talt", () => {
    const okter = ["a", "b", "c", "d", "e"];
    for (const plass of [0, 1, 2, 3, 4, 5, 6]) {
      const { synlige, skjulte } = kappOkter(okter, plass);
      expect(synlige.length + skjulte).toBe(okter.length);
    }
  });

  it("tåler en dag uten økter", () => {
    expect(kappOkter([], 3)).toEqual({ synlige: [], skjulte: 0 });
  });
});
