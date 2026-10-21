import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, slettElevHelt } = await import("./elever");
const { settElevbilde, hentElevbilde, slettElevbilde, slettAlleElevbilder } =
  await import("./elevbilde");
const { hent } = await import("../db");

const BILDE = "data:image/jpeg;base64,AAAA";

beforeEach(() => base.nullstill());

describe("elevbilde", () => {
  it("settes, byttes ut og fjernes — og fjernet betyr tømt", async () => {
    const elev = await opprettElev("Tony", "Soprano");
    await settElevbilde(elev, BILDE, "InSchool");
    await settElevbilde(elev, `${BILDE}B`, "InSchool");
    expect(await hentElevbilde(elev)).toBe(`${BILDE}B`);

    await slettElevbilde(elev);
    expect(await hentElevbilde(elev)).toBeNull();
    const rader = await hent<{ bilde: string | null; slettet: string | null }>(
      "SELECT bilde, slettet FROM elevbilde WHERE elev_id = $1",
      [elev],
    );
    expect(rader).toEqual([{ bilde: null, slettet: expect.any(String) }]);

    // Samme rad tas i bruk igjen (UNIQUE).
    await settElevbilde(elev, BILDE, "InSchool");
    expect(await hentElevbilde(elev)).toBe(BILDE);
  });

  it("forsvinner når eleven slettes", async () => {
    const elev = await opprettElev("Tony", "Soprano");
    await settElevbilde(elev, BILDE, "InSchool");
    await slettElevHelt(elev);
    const [rad] = await hent<{ bilde: string | null }>(
      "SELECT bilde FROM elevbilde WHERE elev_id = $1",
      [elev],
    );
    expect(rad.bilde).toBeNull();
  });

  it("alle kan fjernes under ett, og ingen bilder blir liggende", async () => {
    const a = await opprettElev("Tony", "Soprano");
    const b = await opprettElev("Carmela", "Soprano");
    await settElevbilde(a, BILDE, "InSchool");
    await settElevbilde(b, BILDE, "InSchool");
    expect(await slettAlleElevbilder()).toBe(2);
    const igjen = await hent<{ n: number }>(
      "SELECT COUNT(*) AS n FROM elevbilde WHERE bilde IS NOT NULL",
    );
    expect(igjen[0].n).toBe(0);
  });
});
