import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  lagreSkala,
  malVerdier,
  rangFor,
  slettSkala,
  tilUtkast,
  bruktPerVerdi,
  SkalaFeil,
} = await import("./skalaer");
const { hentSkalaer, hentVerdier, taster } = await import("../skala");
const { opprettSkolear } = await import("./skolear");
const { leggFagIAr } = await import("./fag");
const { opprettElev, koblePaFag } = await import("./elever");
const { opprettVurdering, settResultat } = await import("./vurderinger");

const v = (kode: string) => ({
  id: null,
  kode,
  etikett: "",
  farge: null,
  bestatt: null,
  teller_ikke: 0,
});

beforeEach(() => base.nullstill());

describe("maler og rekkefølge (22.2, 22.3)", () => {
  it("karakter med + og − er ferdig utfylt", () => {
    const k = malVerdier("pm").map((x) => x.kode);
    expect(k[0]).toBe("1");
    expect(k).toContain("2−");
    expect(k).toContain("4+");
    expect(k[k.length - 1]).toBe("6");
    expect(k).toHaveLength(15);
  });

  it("poeng går fra 0 til maks", () => {
    const p = malVerdier("poeng", 20);
    expect(p.map((x) => x.kode)).toEqual(
      Array.from({ length: 21 }, (_, i) => String(i)),
    );
  });

  it("rang følger rekkefølgen, øverst lavest, og 0 bare for «ingenting her»", () => {
    expect(rangFor([v("a"), v("b"), v("c")])).toEqual([10, 20, 30]);
    expect(rangFor([{ ...v("Ikke levert"), null0: true }, v("b")])).toEqual([
      0, 20,
    ]);
  });
});

describe("taster (22.4)", () => {
  const verdier = (n: number, med0 = false) =>
    Array.from({ length: n }, (_, i) => ({
      id: String(i),
      skala_id: "s",
      kode: String(i),
      etikett: null,
      rang: med0 && i === 0 ? 0 : (i + 1) * 10,
      farge: null,
      bestatt: null,
      teller_ikke: 0,
    }));

  it("høyst ni verdier får 1–9 i rekkefølge", () => {
    expect([...taster(verdier(9)).values()]).toEqual("123456789".split(""));
    expect([...taster(verdier(4, true)).values()]).toEqual([
      "0",
      "1",
      "2",
      "3",
    ]);
  });

  it("over ni verdier: ingen taster", () => {
    expect(taster(verdier(10)).size).toBe(0);
    expect(taster(verdier(21)).size).toBe(0);
  });
});

describe("lagring og reglene for brukte skalaer (22.6)", () => {
  it("lager en egen skala og endrer den", async () => {
    const id = await lagreSkala({
      id: null,
      navn: "Måloppnåelse",
      bruksomrade: "vurdering",
      verdier: [v("Ikke vist"), v("Godt"), v("Svært godt")],
    });
    const s = (await hentSkalaer()).find((x) => x.id === id)!;
    expect(s.innebygd).toBe(0);
    let verdier = await hentVerdier(id);
    expect(verdier.map((x) => [x.kode, x.rang])).toEqual([
      ["Ikke vist", 10],
      ["Godt", 20],
      ["Svært godt", 30],
    ]);

    // Ny rekkefølge, en verdi fjernet (ubrukt: myk sletting).
    const u = tilUtkast(s, verdier);
    u.verdier = [u.verdier[2], u.verdier[1]];
    await lagreSkala(u);
    verdier = await hentVerdier(id);
    expect(verdier.map((x) => x.kode)).toEqual(["Svært godt", "Godt"]);
  });

  it("en brukt verdi kan ikke slettes, og ingenting lagres", async () => {
    const id = await lagreSkala({
      id: null,
      navn: "Egen",
      bruksomrade: "vurdering",
      verdier: [v("Lav"), v("Høy")],
    });
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const fag = await leggFagIAr(ar, "HIS3", "Historie", null);
    const elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fag);
    const vurd = await opprettVurdering(fag, id, "Prøve", "skriftlig", null);
    const [lav] = await hentVerdier(id);
    await settResultat(vurd, elev, lav);
    expect((await bruktPerVerdi(id)).get(lav.id)).toBe(1);

    const s = (await hentSkalaer()).find((x) => x.id === id)!;
    const u = tilUtkast(s, await hentVerdier(id));
    u.verdier = u.verdier.filter((x) => x.kode !== "Lav");
    u.navn = "Nytt navn";
    await expect(lagreSkala(u)).rejects.toBeInstanceOf(SkalaFeil);
    expect((await hentVerdier(id)).map((x) => x.kode)).toEqual(["Lav", "Høy"]);
    expect((await hentSkalaer()).find((x) => x.id === id)?.navn).toBe("Egen");

    // Navn og rekkefølge kan endres selv om den er brukt.
    const u2 = tilUtkast(s, await hentVerdier(id));
    u2.navn = "Nytt navn";
    u2.verdier.reverse();
    await lagreSkala(u2);
    expect((await hentVerdier(id)).map((x) => x.kode)).toEqual(["Høy", "Lav"]);

    // Hele skalaen kan ikke slettes når den er brukt.
    await expect(slettSkala(id)).rejects.toBeInstanceOf(SkalaFeil);
  });

  it("en ubrukt skala kan slettes, en innebygd aldri", async () => {
    const id = await lagreSkala({
      id: null,
      navn: "Ubrukt",
      bruksomrade: "begge",
      verdier: [v("a"), v("b")],
    });
    await slettSkala(id);
    expect((await hentSkalaer()).some((x) => x.id === id)).toBe(false);
    const innebygd = (await hentSkalaer()).find((x) => x.innebygd === 1)!;
    await expect(slettSkala(innebygd.id)).rejects.toBeInstanceOf(SkalaFeil);
    await expect(
      lagreSkala(tilUtkast(innebygd, await hentVerdier(innebygd.id))),
    ).rejects.toBeInstanceOf(SkalaFeil);
  });

  it("avviser tomt navn, færre enn to verdier og like koder", async () => {
    const u = { id: null, navn: "X", bruksomrade: "vurdering" as const };
    await expect(
      lagreSkala({ ...u, navn: " ", verdier: [v("a"), v("b")] }),
    ).rejects.toBeInstanceOf(SkalaFeil);
    await expect(
      lagreSkala({ ...u, verdier: [v("a")] }),
    ).rejects.toBeInstanceOf(SkalaFeil);
    await expect(
      lagreSkala({ ...u, verdier: [v("a"), v("A")] }),
    ).rejects.toBeInstanceOf(SkalaFeil);
  });
});
