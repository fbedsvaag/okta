import { describe, expect, it } from "vitest";
import {
  lesInschool,
  navnenokkel,
  somLimInnTekst,
  type Side,
} from "./inschool";

// Samme oppsett som InSchool-utskriften, med fiktive navn: en tabell på
// første side, og bilder i rutenett med navn og klasse under på neste.
const tabell: Side = {
  tekst: [
    { x: 24, y: 797, str: "Blokk_2/SAM3045/Markedsføring og ledelse 1" },
    { x: 29, y: 670, str: "#" },
    { x: 50, y: 670, str: "Klasse" },
    { x: 127, y: 670, str: "Elev" },
    { x: 29, y: 653, str: "01" },
    { x: 50, y: 653, str: "2STA" },
    { x: 127, y: 653, str: "Tony Soprano" },
    { x: 29, y: 636, str: "02" },
    { x: 50, y: 636, str: "2STB" },
    { x: 127, y: 636, str: "Christopher Moltisanti-Aprile" },
    { x: 29, y: 620, str: "03" },
    { x: 50, y: 620, str: "3MKA" },
    { x: 127, y: 620, str: "Adriana La Cerva" },
    { x: 24, y: 14, str: "12.02.2026" },
    { x: 557, y: 14, str: "1/2" },
  ],
  // Logoen oppe til høyre er ikke et portrett.
  bilder: [{ x: 484, y: 784, w: 87, h: 32 }],
};

const bilder: Side = {
  tekst: [
    { x: 24, y: 639, str: "Tony Soprano" },
    { x: 24, y: 627, str: "(2STA)" },
    { x: 117, y: 639, str: "Christopher" },
    { x: 117, y: 627, str: "Moltisanti-" },
    { x: 117, y: 616, str: "Aprile (2STB)" },
    { x: 209, y: 700, str: "Bilde finnes" },
    { x: 209, y: 686, str: "ikke" },
    { x: 209, y: 639, str: "Adriana La Cerva" },
    { x: 209, y: 627, str: "(3MKA)" },
  ],
  bilder: [
    { x: 484, y: 784, w: 87, h: 32 },
    { x: 24, y: 652, w: 78, h: 104 },
    { x: 117, y: 652, w: 78, h: 104 },
  ],
};

describe("lesInschool", () => {
  const r = lesInschool([tabell, bilder]);

  it("leser fagkoden i toppen", () => {
    expect(r.fagkode).toBe("SAM3045");
  });

  it("leser klasselista fra tabellen", () => {
    expect(r.elever).toEqual([
      { navn: "Tony Soprano", klasse: "2STA" },
      { navn: "Christopher Moltisanti-Aprile", klasse: "2STB" },
      { navn: "Adriana La Cerva", klasse: "3MKA" },
    ]);
  });

  it("kobler hvert bilde til navnet under, også når navnet er brukket", () => {
    expect(r.bilder.map((b) => [b.navn, b.side, b.plass.x])).toEqual([
      ["Tony Soprano", 2, 24],
      ["Christopher Moltisanti-Aprile", 2, 117],
    ]);
  });

  it("hopper over logoen og eleven uten bilde", () => {
    expect(r.bilder.some((b) => b.navn.startsWith("Adriana"))).toBe(false);
  });

  it("bruker bildetekstene som liste når tabellen mangler", () => {
    const uten = lesInschool([bilder]);
    expect(uten.elever).toEqual([
      { navn: "Tony Soprano", klasse: "2STA" },
      { navn: "Christopher Moltisanti-Aprile", klasse: "2STB" },
    ]);
  });
});

describe("somLimInnTekst", () => {
  it("skriver «navn; klasse», som lim-inn-parseren forstår", () => {
    expect(
      somLimInnTekst([
        { navn: "Tony Soprano", klasse: "2STA" },
        { navn: "Meadow Soprano", klasse: null },
      ]),
    ).toBe("Tony Soprano; 2STA\nMeadow Soprano");
  });
});

describe("navnenokkel", () => {
  it("ser bort fra mellomrom, bindestrek og store bokstaver", () => {
    expect(navnenokkel("Moltisanti- Aprile")).toBe(
      navnenokkel("moltisanti-aprile"),
    );
  });
});
