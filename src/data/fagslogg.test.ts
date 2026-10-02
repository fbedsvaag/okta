import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettSkolear } = await import("./skolear");
const { leggFagIAr, hentFagIAr } = await import("./fag");
const { opprettOkt, endreOkt, settSkaring, slettOkt } = await import("./okter");
const { opprettElev, koblePaFag } = await import("./elever");
const { hentFagslogg, hentArForFag } = await import("./fagportal");

const GRONN = "5ca1ade1-0001-4000-8000-000000000004";
const IKKE_I_OKTA = "5ca1ade1-0001-4000-8000-000000000001";

let ar1 = "";
let ar2 = "";
let sf1 = "";
let sf2 = "";
let fagId = "";

beforeEach(async () => {
  base.nullstill();
  ar1 = await opprettSkolear("2025/26", "2025-08-18", "2026-06-19");
  ar2 = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  sf1 = await leggFagIAr(ar1, "MFL1", "Markedsføring", null);
  sf2 = await leggFagIAr(ar2, "MFL1", "Markedsføring", null);
  fagId = (await hentFagIAr(ar2))[0].fagId;
});

describe("øktloggen i et fag", () => {
  it("viser bare økter med logg, nyeste først, for det valgte året", async () => {
    const a = await opprettOkt(sf2, "MFL1", "2026-09-01", "08:15", 90);
    const b = await opprettOkt(sf2, "MFL1", "2026-09-08", "08:15", 90);
    await opprettOkt(sf2, "MFL1", "2026-09-15", "08:15", 90);
    const slettet = await opprettOkt(sf2, "MFL1", "2026-09-22", "08:15", 90);
    const ifjor = await opprettOkt(sf1, "MFL1", "2025-09-02", "08:15", 90);
    await endreOkt(a, { logg: "Rolig start" });
    await endreOkt(b, { logg: "Urolig etter lunsj" });
    await endreOkt(slettet, { logg: "borte" });
    await slettOkt(slettet);
    await endreOkt(ifjor, { logg: "I fjor" });

    expect((await hentFagslogg(fagId, ar2)).map((l) => l.logg)).toEqual([
      "Urolig etter lunsj",
      "Rolig start",
    ]);
    expect((await hentFagslogg(fagId, ar1)).map((l) => l.logg)).toEqual([
      "I fjor",
    ]);
  });

  it("teller skåringene, men ikke «ikke i økta»", async () => {
    const o = await opprettOkt(sf2, "MFL1", "2026-09-01", "08:15", 90);
    await endreOkt(o, { logg: "x" });
    const tony = await opprettElev("Tony", "Soprano");
    const aj = await opprettElev("AJ", "Soprano");
    for (const e of [tony, aj]) await koblePaFag(e, sf2);
    await settSkaring(tony, o, GRONN);
    await settSkaring(aj, o, IKKE_I_OKTA);
    expect((await hentFagslogg(fagId, ar2))[0]).toMatchObject({
      gronn: 1,
      gul: 0,
      rod: 0,
    });
  });

  it("vet hvilke år faget er undervist", async () => {
    expect((await hentArForFag(fagId)).map((a) => a.navn)).toEqual([
      "2026/27",
      "2025/26",
    ]);
  });
});
