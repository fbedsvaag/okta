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
  farge: null,
});

const okt = (
  id: string,
  dato: string,
  periodeId: string | null = null,
): Okt => ({
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
  lekse: null,
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
  it("gir perioden økta er farget med", () => {
    expect(periodeFor(okt("o1", "2026-09-01", "p1"), [host, analyse])?.id).toBe(
      "p1",
    );
  });

  it("lar datoen være: en ufarget økt står uten periode", () => {
    // Før ble perioden gjettet ut fra datoen. Nå er det fargen som gjelder,
    // ellers kunne en økt ikke tas ut av en periode.
    expect(periodeFor(okt("o", "2026-09-01"), [host, analyse])).toBeNull();
  });

  it("står uten periode når perioden er slettet", () => {
    expect(
      periodeFor(okt("o", "2026-10-06", "slettet"), [host, analyse]),
    ).toBeNull();
  });
});

describe("fordel", () => {
  const okter = [
    okt("a", "2026-08-18", "p1"),
    okt("b", "2026-09-01", "p1"),
    okt("c", "2026-10-06", "p2"),
    okt("d", "2027-03-01"), // ikke farget
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
    const bunker = fordel([okt("a", "2026-08-18", "p1")], [host, analyse]);
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
