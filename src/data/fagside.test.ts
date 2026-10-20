import { describe, expect, it } from "vitest";
import {
  fasteTider,
  holdteMinutter,
  kortDag,
  maldekning,
  oppramsing,
  periodestolper,
  tempo,
  tempotekst,
} from "./fagside";
import type { Okt } from "./okter";
import type { Periode } from "./perioder";
import { snitt } from "./oktrader";

function okt(id: string, dato: string, ekstra: Partial<Okt> = {}): Okt {
  return {
    id,
    kode: null,
    skolearFagId: "f",
    fagKode: "MFL2",
    fagNavn: "",
    farge: null,
    periodeId: null,
    dato,
    klokkeslett: "08:30",
    varighetMin: 120,
    tellendeMin: 120,
    tema: null,
    sted: null,
    agenda: null,
    lekse: null,
    endret: "",
    plan: null,
    logg: null,
    kladd: null,
    skaret: 0,
    elever: 0,
    gronn: 0,
    gul: 0,
    rod: 0,
    ...ekstra,
  };
}

function periode(id: string, rekkefolge: number): Periode {
  return {
    id,
    skolearFagId: "f",
    navn: id,
    rekkefolge,
    start: null,
    slutt: null,
    kompetansemal: null,
    notat: null,
    farge: "#c9922e",
  };
}

describe("timer på fagsiden", () => {
  it("teller bare økter til og med i dag", () => {
    const o = [
      okt("a", "2026-09-01"),
      okt("b", "2026-10-07"),
      okt("c", "2026-10-08"),
    ];
    expect(holdteMinutter(o, "2026-10-07")).toBe(240);
  });

  it("sier hvor mange timer faget er foran eller bak jevnt tempo", () => {
    // Halvveis i året skal 70 av 140 timer være holdt.
    expect(tempo(72 * 60, 140, "2026-08-01", "2027-06-01", "2026-12-31")).toBe(
      2,
    );
    expect(tempotekst(2)).toEqual({
      tekst: "I rute, 2 timer foran årsplanen",
      bak: false,
    });
    expect(tempotekst(0)).toEqual({ tekst: "I rute", bak: false });
    expect(tempotekst(-4)).toEqual({
      tekst: "Bak, 4 timer bak årsplanen",
      bak: true,
    });
  });

  it("lager én stolpe per periode, i rekkefølge, og en for økter uten periode", () => {
    const o = [
      okt("a", "2026-09-01", { periodeId: "p2" }),
      okt("b", "2026-09-02", { periodeId: "p1" }),
      okt("c", "2026-11-02", { periodeId: "p1" }),
      okt("d", "2026-11-03"),
    ];
    const s = periodestolper(
      o,
      [periode("p2", 2), periode("p1", 1)],
      "2026-10-01",
    );
    expect(s.map((x) => [x.id, x.planlagt, x.holdt])).toEqual([
      ["p1", 240, 0.5],
      ["p2", 120, 1],
      ["", 120, 0],
    ]);
  });
});

describe("faste tider", () => {
  it("finner tidspunktene som går igjen, mandag først", () => {
    const o = [
      okt("a", "2026-10-08", { klokkeslett: "12:30" }), // tor
      okt("b", "2026-10-15", { klokkeslett: "12:30" }),
      okt("c", "2026-10-12", { klokkeslett: "08:30" }), // man
      okt("d", "2026-10-19", { klokkeslett: "08:30" }),
      okt("e", "2026-10-20", { klokkeslett: "10:00" }), // bare én gang
      okt("f", "2026-09-01", { klokkeslett: "14:00" }), // passert
      okt("g", "2026-09-08", { klokkeslett: "14:00" }),
    ];
    expect(fasteTider(o, "2026-10-07")).toBe("man 08:30 og tor 12:30");
  });

  it("ramser opp på norsk", () => {
    expect(oppramsing(["2STA"])).toBe("2STA");
    expect(oppramsing(["2STA", "2STB"])).toBe("2STA og 2STB");
    expect(oppramsing(["1STC", "2STA", "3STB"])).toBe("1STC, 2STA og 3STB");
    expect(kortDag("2026-10-05")).toBe("man 5.10");
  });
});

describe("kompetansemål", () => {
  it("er dekket, påbegynt eller ikke ennå etter hvilke økter som er holdt", () => {
    const o = [
      okt("a", "2026-09-01", { periodeId: "p1" }),
      okt("b", "2026-11-01", { periodeId: "p1" }),
      okt("c", "2026-09-05"),
    ];
    const d = maldekning(
      ["k1", "k2", "k3"],
      o,
      new Map([["p1", ["k1"]]]),
      new Map([["c", ["k2"]]]),
      "2026-10-01",
    );
    expect(d.get("k1")).toEqual({ okter: [true, false], status: "pabegynt" });
    expect(d.get("k2")).toEqual({ okter: [true], status: "dekket" });
    expect(d.get("k3")).toEqual({ okter: [], status: "ikke" });
  });
});

describe("snitt", () => {
  it("regner grønn som 1 og rød som 0, uten ikke i økta", () => {
    expect(snitt(["g", "r", "o"])).toBe(0.5);
    expect(snitt(["o", "n"])).toBeNull();
  });
});
