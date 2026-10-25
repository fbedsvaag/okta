import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const k = await import("./karakterer");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering, settResultat, settFrist } =
  await import("./vurderinger");
const { opprettElev, koblePaFag } = await import("./elever");

const v = (
  id: string,
  over: Partial<import("./karakterer").Karaktervurdering> = {},
) => ({
  id,
  tittel: id,
  type: null,
  dato: null,
  skalaNavn: "Karakter 1–6",
  vektSatt: null,
  tall: true,
  rubrikk: null,
  ...over,
});
const r = (vurderingId: string, tall: number | null, tellerIkke = false) =>
  [
    `${vurderingId}:e`,
    {
      vurderingId,
      elevId: "e",
      kode: tall === null ? "IV" : String(tall),
      tall,
      tellerIkke,
      kommentar: null,
      rubrikkvalg: {},
      leveranse: null,
    },
  ] as const;

describe("vektet snitt", () => {
  it("vekter, og holder «teller ikke» og IV utenfor", () => {
    const vurderinger = [
      v("a", { vektSatt: 2 }),
      v("b"),
      v("c", { vektSatt: 0 }),
      v("d", { tall: false }),
      v("e"),
    ];
    const res = new Map([r("a", 5), r("b", 2), r("c", 1), r("e", null, true)]);
    // (5·2 + 2·1) / 3 = 4
    expect(k.vektetSnitt("e", vurderinger, res)).toBe(4);
    expect(k.vektetSnitt("ingen", vurderinger, res)).toBeNull();
    expect(k.vektFor(v("x", { tall: false }))).toBe(0);
    expect(k.somDesimal(4.25)).toBe("4,3");
  });

  it("deler året ved nyttår, og vurderinger uten dato står i alle", () => {
    expect(k.iTermin("2026-12-18", "host", "2027-06-20")).toBe(true);
    expect(k.iTermin("2027-01-04", "host", "2027-06-20")).toBe(false);
    expect(k.iTermin("2027-01-04", "var", "2027-06-20")).toBe(true);
    expect(k.iTermin(null, "var", "2027-06-20")).toBe(true);
    expect(k.iTermin("2026-09-01", "aar", "2027-06-20")).toBe(true);
  });
});

describe("i basen (migrasjon 037)", () => {
  let fag = "";
  let tony = "";
  beforeEach(async () => {
    base.nullstill();
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    fag = await leggFagIAr(ar, "HIS3", "Historie", null);
    tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fag);
  });

  it("henter resultater, vekt og halvårskarakter", async () => {
    const [skala] = await base.select<{ id: string }[]>(
      "SELECT s.id FROM skala s WHERE s.bruksomrade = 'vurdering' AND EXISTS (SELECT 1 FROM skalaverdi v WHERE v.skala_id = s.id AND v.kode = '5') LIMIT 1",
    );
    const vid = await opprettVurdering(
      fag,
      skala.id,
      "Prøve",
      "skriftlig",
      null,
    );
    await settFrist(vid, "2026-10-01");
    const [fem] = await base.select<
      { id: string; skala_id: string; kode: string; rang: number }[]
    >("SELECT * FROM skalaverdi WHERE skala_id = $1 AND kode = '5'", [
      skala.id,
    ]);
    await settResultat(vid, tony, fem as never);
    await k.settVekt(vid, 2);
    await k.settHalvar(tony, fag, "host", { karakter: "5" });
    await k.settHalvar(tony, fag, "host", { kommentar: "Sterk muntlig" });

    const d = await k.hentKarakterdata(fag);
    expect(d.vurderinger[0]).toMatchObject({ vektSatt: 2, tall: true });
    expect(d.resultater.get(`${vid}:${tony}`)?.tall).toBe(5);
    expect(k.vektetSnitt(tony, d.vurderinger, d.resultater)).toBe(5);
    // Kommentaren ble lagt til uten å ta bort karakteren.
    expect(d.halvar.get(`host:${tony}`)).toEqual({
      karakter: "5",
      kommentar: "Sterk muntlig",
    });
  });
});

describe("kolonneoverskriften (29.4)", () => {
  it("deler tittelen ved kolon", () => {
    expect(k.delTittel("Muntlig: SWOT")).toEqual(["Muntlig", "SWOT"]);
    expect(k.delTittel("Skriftlig prøve: markedsanalyse")).toEqual([
      "Skriftlig prøve",
      "markedsanalyse",
    ]);
    expect(k.delTittel("Kampanjeplan")).toEqual(["Kampanjeplan", ""]);
    expect(k.delTittel(":rart")).toEqual([":rart", ""]);
  });
});
