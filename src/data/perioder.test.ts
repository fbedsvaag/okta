import { describe, expect, it } from "vitest";
import { fordel, overlapp, periodeFor, type Periode } from "./perioder";
import type { Okt } from "./okter";

const periode = (
  id: string,
  navn: string,
  start: string | null,
  slutt: string | null,
): Periode => ({
  id,
  skolearFagId: "sf1",
  navn,
  rekkefolge: 0,
  start,
  slutt,
  kompetansemal: null,
  notat: null,
});

const okt = (id: string, dato: string, periodeId: string | null = null): Okt => ({
  id,
  kode: null,
  skolearFagId: "sf1",
  fagKode: "MFL1",
  fagNavn: "Markedsføring",
  farge: null,
  periodeId,
  dato,
  klokkeslett: null,
  varighetMin: 180,
  tema: null,
    sted: null,
    agenda: null,
    endret: "2026-08-07T00:00:00",
  plan: null,
  logg: null,
  skaret: 0,
  elever: 0,
  gronn: 0,
  gul: 0,
  rod: 0,
});

const host = periode("p1", "Grunnleggende", "2026-08-17", "2026-09-27");
const analyse = periode("p2", "Markedsanalyse", "2026-09-28", "2026-11-14");

describe("periodeFor", () => {
  it("plasserer økta etter dato", () => {
    expect(periodeFor(okt("o1", "2026-09-01"), [host, analyse])?.id).toBe("p1");
    expect(periodeFor(okt("o2", "2026-10-06"), [host, analyse])?.id).toBe("p2");
  });

  it("tar med begge endepunktene", () => {
    expect(periodeFor(okt("o", "2026-08-17"), [host])?.id).toBe("p1");
    expect(periodeFor(okt("o", "2026-09-27"), [host])?.id).toBe("p1");
    expect(periodeFor(okt("o", "2026-09-28"), [host])).toBeNull();
  });

  it("lar en økt uten treff være uplassert", () => {
    expect(periodeFor(okt("o", "2027-03-01"), [host, analyse])).toBeNull();
  });

  it("lar periode_id overstyre datoen", () => {
    // Økta ligger i oktober, men er uttrykkelig lagt til høstperioden.
    const flyttet = okt("o", "2026-10-06", "p1");
    expect(periodeFor(flyttet, [host, analyse])?.id).toBe("p1");
  });

  it("faller tilbake på datoen hvis periode_id peker på noe som er borte", () => {
    const foreldrelos = okt("o", "2026-10-06", "slettet");
    expect(periodeFor(foreldrelos, [host, analyse])?.id).toBe("p2");
  });

  it("ignorerer perioder uten spenn", () => {
    expect(periodeFor(okt("o", "2026-09-01"), [periode("p", "Uten", null, null)]))
      .toBeNull();
  });
});

describe("fordel", () => {
  const okter = [
    okt("a", "2026-08-18"),
    okt("b", "2026-09-01"),
    okt("c", "2026-10-06"),
    okt("d", "2027-03-01"), // utenfor alle perioder
  ];

  it("legger øktene i riktig bunke", () => {
    const bunker = fordel(okter, [host, analyse]);
    expect(bunker[0].okter.map((o) => o.id)).toEqual(["a", "b"]);
    expect(bunker[1].okter.map((o) => o.id)).toEqual(["c"]);
  });

  it("samler de uplasserte til slutt", () => {
    const bunker = fordel(okter, [host, analyse]);
    const siste = bunker[bunker.length - 1];
    expect(siste.periode).toBeNull();
    expect(siste.okter.map((o) => o.id)).toEqual(["d"]);
  });

  it("dropper den uplasserte bunken når alt er plassert", () => {
    const bunker = fordel(okter.slice(0, 3), [host, analyse]);
    expect(bunker.every((b) => b.periode !== null)).toBe(true);
  });

  it("beholder tomme perioder — hullene er det man vil se", () => {
    const bunker = fordel([okt("a", "2026-08-18")], [host, analyse]);
    expect(bunker).toHaveLength(2);
    expect(bunker[1].okter).toHaveLength(0);
    expect(bunker[1].minutter).toBe(0);
  });

  it("summerer minutter og utleder faktisk spenn", () => {
    const bunker = fordel(okter, [host, analyse]);
    expect(bunker[0].minutter).toBe(360);
    expect(bunker[0].faktiskFra).toBe("2026-08-18");
    expect(bunker[0].faktiskTil).toBe("2026-09-01");
  });
});

describe("overlapp", () => {
  it("finner perioder som dekker samme dager", () => {
    const a = periode("a", "A", "2026-08-01", "2026-09-30");
    const b = periode("b", "B", "2026-09-15", "2026-10-31");
    expect(overlapp([a, b])).toHaveLength(1);
  });

  it("regner ikke tilstøtende perioder som overlapp", () => {
    expect(overlapp([host, analyse])).toHaveLength(0);
  });
});
