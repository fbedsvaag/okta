import { describe, expect, it } from "vitest";
import {
  kappOkter,
  okthoyde,
  plassTilOkter,
  tittellinjer,
} from "./Skolekalender";

describe("plassTilOkter", () => {
  it("gir mer plass når ruta er høyere", () => {
    expect(plassTilOkter(140)).toBeGreaterThan(plassTilOkter(80));
  });

  it("trekker fra merkelappen og samtalelinja", () => {
    const tom = plassTilOkter(120);
    expect(plassTilOkter(120, { merkelapp: true })).toBeLessThan(tom);
    expect(plassTilOkter(120, { samtaler: true })).toBeLessThan(tom);
  });
});

describe("tittellinjer", () => {
  it("er 0 uten tittel, og aldri mer enn 2", () => {
    expect(tittellinjer(null, 150)).toBe(0);
    expect(tittellinjer("", 150)).toBe(0);
    expect(tittellinjer("Kort", 150)).toBe(1);
    expect(tittellinjer("x".repeat(200), 150)).toBe(2);
  });

  it("gir høyere brikke for to linjer", () => {
    expect(okthoyde(2)).toBeGreaterThan(okthoyde(1));
    expect(okthoyde(1, 1.2)).toBeGreaterThan(okthoyde(1));
  });
});

describe("kappOkter", () => {
  // Poenget: alle ruter er like høye. En uke der én dag har fem økter skal
  // ikke gjøre hele måneden uleselig.
  it("lar alt stå når det får plass", () => {
    expect(kappOkter(["a", "b"], [40, 40], 100)).toEqual({
      synlige: ["a", "b"],
      skjulte: 0,
    });
  });

  it("fyller plassen helt ut når det går akkurat opp", () => {
    expect(kappOkter(["a", "b", "c"], [40, 30, 30], 100)).toEqual({
      synlige: ["a", "b", "c"],
      skjulte: 0,
    });
  });

  it("gir plass til telleren når det ikke går opp", () => {
    // Tre brikker på 30 i 100 px, med teller på 16: to vises, og telleren
    // sier «+2 til». Telleren skal ikke selv skyve ut en økt i det stille.
    expect(kappOkter(["a", "b", "c", "d"], [30, 30, 30, 30], 100, 16)).toEqual({
      synlige: ["a", "b"],
      skjulte: 2,
    });
  });

  it("regner med at brikkene er ulikt høye", () => {
    // Den første har to linjer tittel og tar nesten alt.
    expect(kappOkter(["a", "b", "c"], [70, 30, 30], 100, 16)).toEqual({
      synlige: ["a"],
      skjulte: 2,
    });
  });

  it("teller alle når det ikke er plass til noen", () => {
    expect(kappOkter(["a", "b", "c"], [40, 40, 40], 20, 16)).toEqual({
      synlige: [],
      skjulte: 3,
    });
  });

  it("mister ingen økter — alt er enten synlig eller talt", () => {
    const okter = ["a", "b", "c", "d", "e"];
    const hoyder = [30, 50, 30, 40, 30];
    for (const plass of [0, 20, 50, 100, 150, 200, 300]) {
      const { synlige, skjulte } = kappOkter(okter, hoyder, plass);
      expect(synlige.length + skjulte).toBe(okter.length);
    }
  });

  it("tåler en dag uten økter", () => {
    expect(kappOkter([], [], 100)).toEqual({ synlige: [], skjulte: 0 });
  });
});
