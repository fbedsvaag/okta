import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const f = await import("./folgopp");
const { opprettElev } = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering, settFrist } = await import("./vurderinger");
const { oppdaterResultat } = await import("./muntlig");

describe("Følg opp i basen (migrasjon 039)", () => {
  let ar = "";
  let tony = "";
  beforeEach(async () => {
    base.nullstill();
    ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    tony = await opprettElev("Tony", "Soprano");
  });

  it("husker fulgt opp per elev og grunn, uten dobbelt", async () => {
    await f.settFulgtOpp(tony, ["rod:o1"]);
    await f.settFulgtOpp(tony, ["rod:o1", "borte:o2"]);
    expect([...(await f.hentFulgt())].sort()).toEqual([
      `${tony}|borte:o2`,
      `${tony}|rod:o1`,
    ]);
  });

  it("finner en innlevering som ikke er levert etter fristen", async () => {
    const fag = await leggFagIAr(ar, "HIS3", "Historie", null);
    const [s] = await base.select<{ id: string }[]>(
      "SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1",
    );
    const v = await opprettVurdering(
      fag,
      s.id,
      "Kampanjeplan",
      "innlevering",
      null,
    );
    await settFrist(v, "2026-09-01");
    await oppdaterResultat(v, tony, { leveranse: "ikke" });
    const [r] = await f.hentFrister(ar);
    expect(r).toMatchObject({
      elevId: tony,
      tittel: "Kampanjeplan",
      hva: "ikke",
    });
  });
});
