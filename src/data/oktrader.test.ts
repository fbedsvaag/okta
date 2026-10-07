import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, koblePaFag } = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, settSkaring } = await import("./okter");
const {
  hentOktrader,
  hentFravaersgrunnlag,
  sisteRuter,
  glipper,
  fravaer,
  hoyesteFravaer,
  fravaersmerke,
  timer,
  prosent,
} = await import("./oktrader");

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
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null, null, 140);
});

async function okt(dato: string, min = 105): Promise<string> {
  return opprettOkt(fagId, "MFL1", dato, "08:15", min);
}

describe("øktradene", () => {
  it("gir alle i faget en verdi i en avholdt økt, også dem som ikke ble trykket på", async () => {
    const tony = await opprettElev("Tony", "Soprano");
    const meadow = await opprettElev("Meadow", "Soprano");
    await koblePaFag(tony, fagId);
    await koblePaFag(meadow, fagId);
    // Elevene ble lagt i faget i dag; økta må ligge etter det for at
    // «ikke trykket på» skal telle som borte.
    const i = await okt("2027-06-01");
    await settSkaring(tony, i, GRONN);

    const rader = await hentOktrader(skolearId);
    expect(rader.map((r) => [r.elevId === tony, r.borte, r.farge])).toEqual(
      expect.arrayContaining([
        [true, 0, "gronn"],
        [false, 1, null],
      ]),
    );
  });

  it("tar ikke med økter ingen er skåret i", async () => {
    const tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fagId);
    await okt("2027-06-01");
    expect(await hentOktrader(skolearId)).toEqual([]);
  });

  it("gir ikke fravær for økter før eleven kom i faget", async () => {
    const tony = await opprettElev("Tony", "Soprano");
    const meadow = await opprettElev("Meadow", "Soprano");
    await koblePaFag(tony, fagId);
    await koblePaFag(meadow, fagId);
    const tidlig = await okt("2026-08-20");
    await settSkaring(tony, tidlig, GRONN);
    const rader = await hentOktrader(skolearId);
    // Meadow ble lagt i faget i dag, etter økta: ingen rad.
    expect(rader.filter((r) => r.elevId === meadow)).toEqual([]);
    expect(rader.filter((r) => r.elevId === tony)).toHaveLength(1);
  });
});

describe("innsats, siste 10", () => {
  it("gir de siste rutene eldst først, med ikke i økta som grått", async () => {
    const tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fagId);
    const verdier = [ROD, GUL, GRONN, IKKE_I_OKTA];
    for (const [i, v] of verdier.entries())
      await settSkaring(tony, await okt(`2026-09-0${i + 1}`), v);

    const rader = await hentOktrader(skolearId);
    expect(sisteRuter(rader, tony)).toEqual(["r", "y", "g", "o"]);
    expect(sisteRuter(rader, tony, null, 2)).toEqual(["g", "o"]);
    expect(sisteRuter(rader, tony, new Set(["annet"]))).toEqual([]);
  });

  it("glipper ved minst to røde blant de fem siste", () => {
    expect(glipper(["g", "r", "y", "r", "g"])).toBe(true);
    expect(glipper(["r", "r", "g", "g", "g", "g", "g"])).toBe(false);
    expect(glipper(["o", "o", "o", "o", "r"])).toBe(false);
  });
});

describe("fravær mot 10 %-grensen", () => {
  it("regner timene eleven var borte mot fagets årstimetall", async () => {
    const tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fagId);
    for (const [i, v] of [IKKE_I_OKTA, IKKE_I_OKTA, GRONN].entries())
      await settSkaring(tony, await okt(`2026-09-0${i + 1}`, 120), v);

    const rader = await hentOktrader(skolearId);
    const grunnlag = await hentFravaersgrunnlag(skolearId);
    const [f] = fravaer(rader, tony, grunnlag);
    expect(f).toMatchObject({
      okter: 3,
      borte: 2,
      borteMin: 240,
      grunnlagMin: 140 * 60,
    });
    // 4 t av 140 t
    expect(f.andel).toBeCloseTo(4 / 140);
    expect(hoyesteFravaer([f])).toBe(f);
  });

  it("regner av planlagte timer når faget mangler årstimetall", async () => {
    const uten = await leggFagIAr(skolearId, "ENG1", "Engelsk", null);
    await opprettOkt(uten, "ENG1", "2026-09-01", "08:15", 90);
    await opprettOkt(uten, "ENG1", "2026-09-02", "08:15", 90);
    const g = await hentFravaersgrunnlag(skolearId);
    expect(g.get(uten)).toBe(180);
  });

  it("merker halvveis, nær grensen og over grensen", () => {
    expect(fravaersmerke(0.04)).toBeNull();
    expect(fravaersmerke(0.05)).toEqual({ tekst: "Halvveis", niva: "gul" });
    expect(fravaersmerke(0.08)).toEqual({ tekst: "Nær grensen", niva: "gul" });
    expect(fravaersmerke(0.1)).toEqual({ tekst: "Nær grensen", niva: "gul" });
    expect(fravaersmerke(0.113)).toEqual({
      tekst: "Over grensen",
      niva: "rod",
    });
    expect(fravaersmerke(null)).toBeNull();
  });

  it("skriver timer og prosent på norsk", () => {
    expect(timer(945)).toBe("15,8 t");
    expect(timer(840)).toBe("14 t");
    expect(prosent(0.113)).toBe("11 %");
    expect(prosent(0.004)).toBe("0,4 %");
    expect(prosent(0)).toBe("0 %");
  });
});
