import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, endreOkt, slettOkt, dupliserOkt, hentOkter } =
  await import("./okter");
const { settOktmal } = await import("./perioder");
const { opprettVurdering, knyttOkt } = await import("./vurderinger");
const { hent } = await import("../db");

const KARAKTER = "5ca1a000-0000-4000-8000-000000000004";
let fagId = "";

beforeEach(async () => {
  base.nullstill();
  const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(ar, "REL3", "Religion", null);
});

const frist = async (id: string) =>
  (
    await hent<{ frist: string }>("SELECT frist FROM vurdering WHERE id = $1", [
      id,
    ])
  )[0].frist;

describe("fristen følger økta (#2)", () => {
  it("flytter fristen når økta er vurderingens eneste og fristen sto på den", async () => {
    const okt = await opprettOkt(fagId, "REL3", "2026-10-29", "12:30", 90);
    const v = await opprettVurdering(
      fagId,
      KARAKTER,
      "Presentasjon",
      "muntlig",
      "2026-10-29",
    );
    await knyttOkt(v, okt);
    await endreOkt(okt, { dato: "2026-11-05" });
    expect(await frist(v)).toBe("2026-11-05");
  });

  it("lar fristen stå når vurderingen går over flere økter", async () => {
    const a = await opprettOkt(fagId, "REL3", "2026-10-29", "12:30", 90);
    const b = await opprettOkt(fagId, "REL3", "2026-11-05", "12:30", 90);
    const v = await opprettVurdering(
      fagId,
      KARAKTER,
      "Prosjekt",
      "praktisk",
      "2026-11-05",
    );
    await knyttOkt(v, a);
    await knyttOkt(v, b);
    await endreOkt(b, { dato: "2026-11-12" });
    expect(await frist(v)).toBe("2026-11-05");
  });

  it("lar fristen stå når den er en annen dag enn økta", async () => {
    const okt = await opprettOkt(fagId, "REL3", "2026-10-29", "12:30", 90);
    const v = await opprettVurdering(
      fagId,
      KARAKTER,
      "Innlevering",
      "skriftlig",
      "2026-11-02",
    );
    await knyttOkt(v, okt);
    await endreOkt(okt, { dato: "2026-10-30" });
    expect(await frist(v)).toBe("2026-11-02");
  });
});

describe("økt-koden (#8)", () => {
  const kode = async (id: string) =>
    (
      await hent<{ kode: string }>("SELECT kode FROM okt WHERE id = $1", [id])
    )[0].kode;

  it("blir ikke lik en som finnes etter en sletting", async () => {
    const a = await opprettOkt(fagId, "REL3", "2026-10-01", "08:30", 90);
    const b = await opprettOkt(fagId, "REL3", "2026-10-08", "08:30", 90);
    const c = await opprettOkt(fagId, "REL3", "2026-10-15", "08:30", 90);
    expect([await kode(a), await kode(b), await kode(c)]).toEqual([
      "2610-REL3-1",
      "2610-REL3-2",
      "2610-REL3-3",
    ]);
    await slettOkt(b);
    const d = await opprettOkt(fagId, "REL3", "2026-10-22", "08:30", 90);
    expect(await kode(d)).toBe("2610-REL3-4");
  });
});

describe("duplisering (#9)", () => {
  it("tar med kompetansemålene, men ikke loggen", async () => {
    const okt = await opprettOkt(fagId, "REL3", "2026-10-01", "08:30", 90);
    await endreOkt(okt, {
      tema: "Hinduisme",
      kompetansemal: "Egne mål",
      logg: "Gikk fint",
    });
    await settOktmal(okt, "KM1", true);
    await settOktmal(okt, "KM2", true);
    const [kilde] = (
      await hentOkter(
        (await hent<{ id: string }>("SELECT id FROM skolear"))[0].id,
      )
    ).filter((o) => o.id === okt);

    const ny = await dupliserOkt(kilde, "REL3", "2026-10-08");
    const [kopi] = await hent<{
      tema: string;
      kompetansemal: string;
      logg: string | null;
      dato: string;
    }>("SELECT tema, kompetansemal, logg, dato FROM okt WHERE id = $1", [ny]);
    expect(kopi).toEqual({
      tema: "Hinduisme",
      kompetansemal: "Egne mål",
      logg: null,
      dato: "2026-10-08",
    });
    const mal = await hent<{ kode: string }>(
      "SELECT kode FROM okt_kompetansemal WHERE okt_id = $1 AND slettet IS NULL ORDER BY kode",
      [ny],
    );
    expect(mal.map((m) => m.kode)).toEqual(["KM1", "KM2"]);
  });
});
