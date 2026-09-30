import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, koblePaFag, frakobleFag } = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { hentElevFag, hentHeatmap } = await import("./elevportal");

let skolearId = "";
let fagId = "";

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
});

describe("fag fra elevkortet", () => {
  it("en elev som kobles på et fag fra kortet, står i faget etterpå", async () => {
    const elev = await opprettElev("Tony", "Soprano");
    expect(await hentElevFag(elev, skolearId)).toEqual([]);
    await koblePaFag(elev, fagId);
    expect(
      (await hentElevFag(elev, skolearId)).map((f) => f.skolearFagId),
    ).toEqual([fagId]);
  });

  it("kan kobles fra og på igjen", async () => {
    const elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fagId);
    await frakobleFag(elev, fagId);
    expect(await hentElevFag(elev, skolearId)).toEqual([]);
    await koblePaFag(elev, fagId);
    expect(await hentElevFag(elev, skolearId)).toHaveLength(1);
  });

  it("heatmapet henter uten feil for et nytt fag uten økter", async () => {
    const elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fagId);
    await expect(hentHeatmap(elev, skolearId)).resolves.toBeDefined();
  });
});
