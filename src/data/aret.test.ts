import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";
import type { Okt } from "./okter";
import type { Fridag } from "./kalender";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  lagStripe,
  spennene,
  oktertall,
  tilOkt,
  grenser,
  nyFordeling,
  baklengs,
  tildel,
  nyPeriode,
} = await import("./aret");
const { leggFagIAr } = await import("./fag");
const { opprettOkt, hentOkter } = await import("./okter");
const { opprettSkolear } = await import("./skolear");
const { hentPerioder } = await import("./perioder");

const okt = (id: string, dato: string, periodeId: string | null = null) =>
  ({ id, dato, klokkeslett: null, periodeId }) as Okt;

const ferie = (navn: string, fra: string, til: string): Fridag => ({
  id: navn,
  skolearId: "ar",
  navn,
  type: "ferie",
  fra,
  til,
});

describe("stripa", () => {
  // Mandager og torsdager rundt høstferien (uke 41).
  const okter = [
    okt("a", "2026-09-28"),
    okt("b", "2026-10-01"),
    okt("c", "2026-10-12"),
    okt("d", "2026-10-15"),
  ];

  it("legger ferien inn på ukedagene faget har", () => {
    const s = lagStripe(okter, [
      ferie("Høstferie", "2026-10-05", "2026-10-09"),
    ]);
    expect(s.map((p) => (p.slag === "okt" ? p.okt.id : `F ${p.dato}`))).toEqual(
      ["a", "b", "F 2026-10-05", "F 2026-10-08", "c", "d"],
    );
    expect(oktertall(s, 0, 5)).toBe(4);
  });

  it("start og slutt hopper ut av ferien", () => {
    const s = lagStripe(okter, [
      ferie("Høstferie", "2026-10-05", "2026-10-09"),
    ]);
    expect(tilOkt(s, 2, 1)).toBe(4);
    expect(tilOkt(s, 3, -1)).toBe(1);
  });
});

describe("periodene i stripa", () => {
  const s = lagStripe(
    [
      okt("a", "2026-09-01", "p"),
      okt("b", "2026-09-08", "p"),
      okt("c", "2026-09-15"),
      okt("d", "2026-09-22", "q"),
      okt("e", "2026-09-29", "q"),
    ],
    [],
  );
  const sp = spennene(s);

  it("har spenn fra første til siste økt", () => {
    expect(sp.get("p")).toEqual({ fra: 0, til: 1, antall: 2 });
    expect(sp.get("q")).toEqual({ fra: 3, til: 4, antall: 2 });
  });

  it("stopper mot naboene", () => {
    expect(grenser(sp, "p", 0, s.length)).toEqual({ min: 0, maks: 2 });
    expect(grenser(sp, null, 2, s.length)).toEqual({ min: 2, maks: 2 });
  });

  it("gir perioden nøyaktig øktene i spennet, også fra en nabo", () => {
    const e = nyFordeling(s, "p", 1, 3);
    expect(e).toEqual([
      { oktId: "a", fra: "p", til: null },
      { oktId: "c", fra: null, til: "p" },
      { oktId: "d", fra: "q", til: "p" },
    ]);
    expect(baklengs(e)[2]).toEqual({ oktId: "d", fra: "p", til: "q" });
  });
});

describe("lagring", () => {
  let skolearId = "";
  let fagId = "";
  beforeEach(async () => {
    base.nullstill();
    skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
  });

  it("tildeler i én omgang og setter start og slutt etter øktene", async () => {
    for (const d of ["2026-09-01", "2026-09-08", "2026-09-15"])
      await opprettOkt(fagId, "MFL1", d, null, 90);
    const p = await nyPeriode(fagId, "Markedsanalyse", "#c9922e");
    let okter = await hentOkter(skolearId);
    let stripe = lagStripe(okter, []);
    await tildel(nyFordeling(stripe, p, 0, 1), stripe);

    okter = await hentOkter(skolearId);
    expect(okter.map((o) => o.periodeId)).toEqual([p, p, null]);
    let [per] = await hentPerioder(fagId);
    expect([per.start, per.slutt, per.farge]).toEqual([
      "2026-09-01",
      "2026-09-08",
      "#c9922e",
    ]);

    // Flytt én økt til høyre, så angre.
    stripe = lagStripe(okter, []);
    const e = nyFordeling(stripe, p, 1, 2);
    await tildel(e, stripe);
    [per] = await hentPerioder(fagId);
    expect([per.start, per.slutt]).toEqual(["2026-09-08", "2026-09-15"]);

    stripe = lagStripe(await hentOkter(skolearId), []);
    await tildel(baklengs(e), stripe);
    [per] = await hentPerioder(fagId);
    expect([per.start, per.slutt]).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("en periode uten økter står uten spenn", async () => {
    await opprettOkt(fagId, "MFL1", "2026-09-01", null, 90);
    const p = await nyPeriode(fagId, "A", null);
    let stripe = lagStripe(await hentOkter(skolearId), []);
    await tildel(nyFordeling(stripe, p, 0, 0), stripe);
    stripe = lagStripe(await hentOkter(skolearId), []);
    await tildel(nyFordeling(stripe, p, 5, 4), stripe);
    const [per] = await hentPerioder(fagId);
    expect([per.start, per.slutt]).toEqual([null, null]);
  });
});
