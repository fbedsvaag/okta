import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, koblePaFag, frakobleFag } = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, settSkaring } = await import("./okter");
const { hentGlipp } = await import("./dashbord");

// Trafikklyset fra 002_seed_skalaer.sql.
const IKKE_I_OKTA = "5ca1ade1-0001-4000-8000-000000000001";
const ROD = "5ca1ade1-0001-4000-8000-000000000002";
const GUL = "5ca1ade1-0001-4000-8000-000000000003";
const GRONN = "5ca1ade1-0001-4000-8000-000000000004";

let skolearId = "";
let fagId = "";

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
});

async function elevMed(navn: string, verdier: string[]): Promise<string> {
  const elev = await opprettElev(navn, "Soprano");
  await koblePaFag(elev, fagId);
  for (const [i, v] of verdier.entries()) {
    const okt = await opprettOkt(
      fagId,
      "MFL1",
      `2026-09-0${i + 1}`,
      "08:15",
      90,
    );
    await settSkaring(elev, okt, v);
  }
  return elev;
}

describe("elever som glipper", () => {
  it("står med lavest snitt først, og snittet går fra 0 til 1", async () => {
    await elevMed("Meadow", [GRONN, GRONN]);
    await elevMed("Tony", [ROD, GUL]);
    await elevMed("Carmela", [GUL, GRONN]);

    const rader = await hentGlipp(skolearId);
    expect(rader.map((r) => r.fornavn)).toEqual(["Tony", "Carmela", "Meadow"]);
    expect(rader.map((r) => r.snitt)).toEqual([0.25, 0.75, 1]);
  });

  it("lar «ikke i økta» være utenfor snittet", async () => {
    await elevMed("AJ", [GRONN, IKKE_I_OKTA, IKKE_I_OKTA]);
    const [aj] = await hentGlipp(skolearId);
    expect(aj).toMatchObject({ snitt: 1, antall: 1 });
  });

  it("tar ikke med elever som er tatt ut av faget", async () => {
    const tony = await elevMed("Tony", [ROD]);
    await frakobleFag(tony, fagId);
    expect(await hentGlipp(skolearId)).toEqual([]);
  });
});
