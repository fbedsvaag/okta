import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, endreOkt, slettOkt } = await import("./okter");
const { opprettPeriode, settPeriodemal, settOktmal, hentOktmal } =
  await import("./perioder");

let fagId = "";

beforeEach(async () => {
  base.nullstill();
  const skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null, "MFL1001");
});

describe("kompetansemål på en økt", () => {
  it("kan slås på, av og på igjen", async () => {
    const okt = await opprettOkt(fagId, "MFL1", "2026-09-01", "08:15", 90);
    await settOktmal(okt, "KM1", true);
    await settOktmal(okt, "KM2", true);
    await settOktmal(okt, "KM1", false);
    expect((await hentOktmal(okt)).egne).toEqual(["KM2"]);
    await settOktmal(okt, "KM1", true);
    expect((await hentOktmal(okt)).egne).toEqual(["KM1", "KM2"]);
  });

  it("arver målene til perioden sin", async () => {
    const periode = await opprettPeriode(
      fagId,
      "Markedsanalyse",
      null,
      null,
      1,
    );
    await settPeriodemal(periode, "KM7", true);
    const okt = await opprettOkt(fagId, "MFL1", "2026-09-01", "08:15", 90);
    await endreOkt(okt, { periode_id: periode });

    const mal = await hentOktmal(okt);
    expect(mal).toMatchObject({
      grepKode: "MFL1001",
      egne: [],
      fraPeriode: ["KM7"],
      periodeNavn: "Markedsanalyse",
    });
  });

  it("vet hvilke mål som er dekket i andre økter, men ikke i slettede", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-09-01", "08:15", 90);
    const b = await opprettOkt(fagId, "MFL1", "2026-09-02", "08:15", 90);
    const c = await opprettOkt(fagId, "MFL1", "2026-09-03", "08:15", 90);
    await settOktmal(b, "KM3", true);
    await settOktmal(c, "KM4", true);
    await slettOkt(c);
    expect([...(await hentOktmal(a)).dekketAndreSteder]).toEqual(["KM3"]);
  });
});
