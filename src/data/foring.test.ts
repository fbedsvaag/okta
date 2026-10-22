import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const f = await import("./foring");
const m = await import("./muntlig");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering, knyttOkt, hentVurderinger } =
  await import("./vurderinger");
const { opprettElev } = await import("./elever");
const { opprettOkt, settSkaring } = await import("./okter");

describe("føring, rent", () => {
  it("satt for hånd gjelder, så fraværet, så karakteren", () => {
    expect(f.leveranseFor("ikke", true, true)).toBe("ikke");
    expect(f.leveranseFor(null, true, false)).toBe("borte");
    expect(f.leveranseFor(null, false, true)).toBe("levert");
    expect(f.leveranseFor(null, false, false)).toBeNull();
  });

  it("legger en frase til på slutten", () => {
    expect(f.leggTilFrase("", "Godt jobbet!")).toBe("Godt jobbet!");
    expect(f.leggTilFrase("Ryddig.  ", "Bruk flere kilder.")).toBe(
      "Ryddig. Bruk flere kilder.",
    );
  });

  it("leser en kolonne fra Excel: første kolonne, tomme linjer i midten står", () => {
    expect(f.lesKolonne("4\t\tGodt\r\n\r\n5\n6\n\n")).toEqual([
      "4",
      "",
      "5",
      "6",
    ]);
  });
});

describe("føring i basen (migrasjon 035)", () => {
  let fag = "";
  let vurdering = "";
  let tony = "";
  let paulie = "";
  beforeEach(async () => {
    base.nullstill();
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    fag = await leggFagIAr(ar, "HIS3", "Historie", null);
    const [s] = await base.select<{ id: string }[]>(
      "SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1",
    );
    vurdering = await opprettVurdering(fag, s.id, "Prøve", "skriftlig", null);
    tony = await opprettElev("Tony", "Soprano");
    paulie = await opprettElev("Paulie", "Gualtieri");
  });

  it("lagrer faste fraser per vurdering", async () => {
    expect(await f.hentFraser(vurdering)).toEqual([]);
    await f.settFraser(vurdering, ["Godt jobbet!", "Husk å konkludere."]);
    expect(await f.hentFraser(vurdering)).toEqual([
      "Godt jobbet!",
      "Husk å konkludere.",
    ]);
  });

  it("holder levert i takt med levert / ikke levert / borte", async () => {
    await m.oppdaterResultat(vurdering, tony, { leveranse: "levert" });
    await m.oppdaterResultat(vurdering, paulie, { leveranse: "borte" });
    const r = await m.hentMuntligResultater(vurdering);
    expect(r.get(tony)?.leveranse).toBe("levert");
    expect(r.get(paulie)?.leveranse).toBe("borte");
    const v = (
      await hentVurderinger(
        (await base.select<{ id: string }[]>("SELECT id FROM skolear"))[0].id,
      )
    ).find((x) => x.id === vurdering)!;
    expect(v.levert).toBe(1);
    await m.oppdaterResultat(vurdering, tony, { leveranse: "ikke" });
    const [rad] = await base.select<{ levert: number }[]>(
      "SELECT levert FROM vurderingsresultat WHERE elev_id = $1",
      [tony],
    );
    expect(rad.levert).toBe(0);
  });

  it("henter «borte» fra fraværet i øktene vurderingen holdes i", async () => {
    const okt = await opprettOkt(fag, "HIS3", "2026-09-24", "08:30", 90);
    await knyttOkt(vurdering, okt);
    const [iv] = await base.select<{ id: string }[]>(
      "SELECT id FROM skalaverdi WHERE teller_ikke = 1 LIMIT 1",
    );
    const [gronn] = await base.select<{ id: string }[]>(
      "SELECT id FROM skalaverdi WHERE farge = 'gronn' LIMIT 1",
    );
    await settSkaring(tony, okt, iv.id);
    await settSkaring(paulie, okt, gronn.id);
    expect([...(await f.hentBorteIOkt(vurdering))]).toEqual([tony]);
  });
});
