import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr } = await import("./fag");
const { opprettOkt, hentOkter } = await import("./okter");
const { opprettSkolear } = await import("./skolear");
const { opprettPeriode, endrePeriode, fargelegg, hentPerioder, PERIODEFARGER } =
  await import("./perioder");

let skolearId = "";
let fagId = "";

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
});

const periodeAv = async (oktId: string) =>
  (await hentOkter(skolearId)).find((o) => o.id === oktId)?.periodeId ?? null;

describe("fargelegging av økter", () => {
  it("gir hver ny periode sin egen farge", async () => {
    await opprettPeriode(fagId, "A", null, null, 1);
    await opprettPeriode(fagId, "B", null, null, 2);
    const [a, b] = await hentPerioder(fagId);
    expect(a.farge).toBe(PERIODEFARGER[0]);
    expect(b.farge).toBe(PERIODEFARGER[1]);
  });

  it("setter perioden på øktene, og spennet følger det som er farget", async () => {
    const o1 = await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180);
    const o2 = await opprettOkt(fagId, "MFL1", "2026-09-08", null, 180);
    const o3 = await opprettOkt(fagId, "MFL1", "2026-09-15", null, 180);
    const p = await opprettPeriode(fagId, "Markedsanalyse", null, null, 1);

    await fargelegg([o1, o2], p);
    expect(await periodeAv(o1)).toBe(p);
    expect(await periodeAv(o3)).toBeNull();
    const [etter] = await hentPerioder(fagId);
    expect([etter.start, etter.slutt]).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("tar en økt ut av perioden med viskelæret, og krymper spennet", async () => {
    const o1 = await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180);
    const o2 = await opprettOkt(fagId, "MFL1", "2026-09-08", null, 180);
    const p = await opprettPeriode(fagId, "A", null, null, 1);
    await fargelegg([o1, o2], p);
    await fargelegg([o2], null);
    expect(await periodeAv(o2)).toBeNull();
    const [etter] = await hentPerioder(fagId);
    expect(etter.slutt).toBe("2026-09-01");
  });

  it("flytter økta fra én periode til en annen, og justerer begge", async () => {
    const o1 = await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180);
    const o2 = await opprettOkt(fagId, "MFL1", "2026-09-08", null, 180);
    const a = await opprettPeriode(fagId, "A", null, null, 1);
    const b = await opprettPeriode(fagId, "B", null, null, 2);
    await fargelegg([o1, o2], a);
    await fargelegg([o2], b);
    const perioder = await hentPerioder(fagId);
    const pa = perioder.find((p) => p.id === a)!;
    const pb = perioder.find((p) => p.id === b)!;
    expect([pa.start, pa.slutt]).toEqual(["2026-09-01", "2026-09-01"]);
    expect([pb.start, pb.slutt]).toEqual(["2026-09-08", "2026-09-08"]);
  });

  it("gir en ny økt midt i en farget periode samme farge", async () => {
    const o1 = await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180);
    const o2 = await opprettOkt(fagId, "MFL1", "2026-09-15", null, 180);
    const p = await opprettPeriode(fagId, "A", null, null, 1);
    await fargelegg([o1, o2], p);
    const midt = await opprettOkt(fagId, "MFL1", "2026-09-08", null, 180);
    const etter = await opprettOkt(fagId, "MFL1", "2026-10-01", null, 180);
    expect(await periodeAv(midt)).toBe(p);
    expect(await periodeAv(etter)).toBeNull();
  });

  it("farger øktene i spennet når det settes for hånd i periodevisningen", async () => {
    const o1 = await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180);
    const o2 = await opprettOkt(fagId, "MFL1", "2026-10-01", null, 180);
    const p = await opprettPeriode(fagId, "A", null, null, 1);
    await endrePeriode(p, { start: "2026-08-20", slutt: "2026-09-20" });
    expect(await periodeAv(o1)).toBe(p);
    expect(await periodeAv(o2)).toBeNull();
  });
});
