import { describe, expect, it } from "vitest";
import { sok, tolkDato, type Sokeelev, type Sokeokt } from "./sok";

const elever: Sokeelev[] = [
  {
    id: "tony",
    fornavn: "Tony",
    etternavn: "Soprano",
    klasse: "1STC",
    fag: ["SAM3045"],
  },
  {
    id: "carm",
    fornavn: "Carmela",
    etternavn: "Soprano",
    klasse: "1STC",
    fag: [],
  },
  {
    id: "adri",
    fornavn: "Adriana",
    etternavn: "La Cerva",
    klasse: "2STA",
    fag: ["ENG1"],
  },
  {
    id: "tonyb",
    fornavn: "Antonio",
    etternavn: "Blundetto",
    klasse: "3STB",
    fag: [],
  },
];

const okt = (
  id: string,
  dato: string,
  tema: string | null,
  fagKode = "SAM3045",
): Sokeokt => ({
  id,
  dato,
  klokkeslett: "09:15",
  tema,
  fagKode,
  fagNavn: fagKode === "SAM3045" ? "Markedsføring og ledelse 1" : "Engelsk",
  alias: fagKode === "SAM3045" ? "MFL1" : null,
});

const okter = [
  okt("a", "2026-09-01", "Markedsanalyse"),
  okt("b", "2026-10-12", "Segmentering"),
  okt("c", "2026-10-12", "Essay", "ENG1"),
  okt("d", "2027-02-02", "Markedsanalyse repetisjon"),
];

const kilder = { elever, okter, idag: "2026-10-01" };
const ider = (t: ReturnType<typeof sok>) =>
  t.map((x) => (x.type === "elev" ? x.elev.id : x.okt.id));

describe("tolkDato", () => {
  it("forstår ISO, også uten dag", () => {
    expect(tolkDato("2026-10-12")).toBe("2026-10-12");
    expect(tolkDato("2026-10")).toBe("2026-10");
    expect(tolkDato("2026-9-1")).toBe("2026-09-01");
  });

  it("forstår norske formater med og uten år", () => {
    expect(tolkDato("12.10.2026")).toBe("2026-10-12");
    expect(tolkDato("12.10.26")).toBe("2026-10-12");
    expect(tolkDato("12.10")).toBe("-10-12");
    expect(tolkDato("12.10.")).toBe("-10-12");
    expect(tolkDato("12/10")).toBe("-10-12");
    expect(tolkDato("1.9")).toBe("-09-01");
  });

  it("lar vanlige ord og tall være", () => {
    expect(tolkDato("mfl1")).toBeNull();
    expect(tolkDato("2026")).toBeNull();
    expect(tolkDato("45.13")).toBeNull();
  });
});

describe("sok", () => {
  it("finner elever på fornavn, etternavn og klasse", () => {
    expect(ider(sok("tony", kilder))).toEqual(["tony"]);
    expect(ider(sok("soprano", kilder))).toEqual(["carm", "tony"]);
    expect(ider(sok("soprano 1stc carm", kilder))).toEqual(["carm"]);
  });

  it("finner økter på tema, i datorekkefølge fra i dag", () => {
    expect(ider(sok("markedsanalyse", kilder))).toEqual(["a", "d"]);
  });

  it("setter treff i temaet foran treff i fagnavnet", () => {
    // «markeds» står i fagnavnet til alle SAM3045-øktene. De med ordet i
    // temaet skal likevel komme først, selv når de ligger lenger unna i tid.
    const t = ider(sok("markeds", kilder));
    expect(t.slice(0, 2)).toEqual(["a", "d"]);
    expect(t).toContain("b");
  });

  it("finner faget på aliaset, og på koden", () => {
    expect(ider(sok("mfl1 segment", kilder))).toEqual(["b"]);
    expect(ider(sok("sam3045 segment", kilder))).toEqual(["b"]);
  });

  it("finner økter på dato i alle formatene", () => {
    for (const d of [
      "2026-10-12",
      "12.10.2026",
      "12.10.26",
      "12.10",
      "12/10",
    ]) {
      expect(ider(sok(d, kilder)).sort()).toEqual(["b", "c"]);
    }
  });

  it("kombinerer dato og fag", () => {
    expect(ider(sok("2026-10-12 mfl1", kilder))).toEqual(["b"]);
    expect(ider(sok("eng1 12.10", kilder))).toEqual(["c"]);
  });

  it("viser ikke elever når det søkes på en dato", () => {
    expect(sok("2026-10", kilder).every((t) => t.type === "okt")).toBe(true);
  });

  it("gir ingenting for et tomt søk", () => {
    expect(sok("  ", kilder)).toEqual([]);
  });
});
