import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, koblePaFag, settKjonn } = await import("./elever");
const { hentElevGrunnlag } = await import("./elevportal");
const { hentAlleKjonn } = await import("./elevbilde");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, settSkaring } = await import("./okter");
const { byggArkiv } = await import("./arkiv");

/**
 * Kjønn på eleven (SPEC §4.11): valgfritt, brukes bare til å blande i
 * klassekartet, vises bare i elevkortet og går aldri ut av appen.
 */
const GRONN = "5ca1ade1-0001-4000-8000-000000000004";
const skolear = {
  id: "",
  navn: "2026/27",
  start: "2026-08-17",
  slutt: "2027-06-20",
};
let fag = "";
let tony = "";

beforeEach(async () => {
  base.nullstill();
  skolear.id = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(skolear.id, "MFL1", "Markedsføring", null);
  tony = await opprettElev("Tony", "Soprano");
  await koblePaFag(tony, fag);
});

describe("kjønn på eleven", () => {
  it("er ikke satt for en ny elev", async () => {
    const e = await hentElevGrunnlag(tony);
    expect(e?.kjonn).toBeNull();
    expect(e?.kjonnKilde).toBeNull();
  });

  it("settes for hånd, og kan tas bort igjen", async () => {
    await settKjonn(tony, "g");
    let e = await hentElevGrunnlag(tony);
    expect([e?.kjonn, e?.kjonnKilde]).toEqual(["g", "satt"]);
    expect((await hentAlleKjonn()).get(tony)).toBe("g");

    await settKjonn(tony, null);
    e = await hentElevGrunnlag(tony);
    expect([e?.kjonn, e?.kjonnKilde]).toEqual([null, null]);
    expect((await hentAlleKjonn()).has(tony)).toBe(false);
  });

  it("bekrefter en gjetning når det settes", async () => {
    await base.execute(
      "UPDATE elev SET kjonn = 'g', kjonn_kilde = 'gjettet' WHERE id = $1",
      [tony],
    );
    await settKjonn(tony, "g");
    expect((await hentElevGrunnlag(tony))?.kjonnKilde).toBe("satt");
  });

  it("merkes som gjettet når importen setter det", async () => {
    await settKjonn(tony, "g", "gjettet");
    const e = await hentElevGrunnlag(tony);
    expect([e?.kjonn, e?.kjonnKilde]).toEqual(["g", "gjettet"]);
  });

  it("er ikke med i årsarkivet", async () => {
    await settKjonn(tony, "g");
    const o = await opprettOkt(fag, "MFL1", "2026-09-01", "08:15", 90);
    await settSkaring(tony, o, GRONN);
    const filer = await byggArkiv(skolear);
    expect(filer.length).toBeGreaterThan(0);
    for (const f of filer)
      expect(f.innhold).not.toMatch(/kjønn|kjonn|\bgutt\b|\bjente\b/i);
  });

  it("nevnes ikke i noen av modulene som skriver ut av appen", () => {
    for (const fil of [
      "arkiv.ts",
      "arsplaneksport.ts",
      "arsplandocx.ts",
      "ical.ts",
      "caldav.ts",
      "kalenderfeed.ts",
    ]) {
      const kode = readFileSync(join(import.meta.dirname, fil), "utf8");
      expect(kode, fil).not.toMatch(/kjonn/);
    }
  });
});
