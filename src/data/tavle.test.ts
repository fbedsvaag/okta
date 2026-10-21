import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, endreOkt, hentOkter, settSkaring } =
  await import("./okter");
const { settOktmal, opprettPeriode, hentPerioder, fargelegg } =
  await import("./perioder");
const { opprettVurdering, knyttOkt } = await import("./vurderinger");
const { lagStripe } = await import("./aret");
const { byttInnhold, kilder, kolonner, tilKolonne } = await import("./tavle");
const { hent } = await import("../db");

const KARAKTER = "5ca1a000-0000-4000-8000-000000000004";
let ar = "";
let fag = "";

beforeEach(async () => {
  base.nullstill();
  ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(ar, "HIS3", "Historie", null);
});

async function rekke() {
  return (await hentOkter(ar))
    .filter((o) => o.skolearFagId === fag)
    .sort((a, b) => a.dato.localeCompare(b.dato));
}

async function fire(): Promise<string[]> {
  const ider: string[] = [];
  for (const [d, t] of [
    ["2026-09-01", "A"],
    ["2026-09-02", "B"],
    ["2026-09-03", "C"],
    ["2026-09-04", "D"],
  ]) {
    const id = await opprettOkt(fag, "HIS3", d, "08:30", 90);
    await endreOkt(id, { tema: t });
    ider.push(id);
  }
  return ider;
}

describe("kildene (21.1)", () => {
  it("bytter de to, økt for økt", () => {
    expect([...kilder(0, 2)].sort()).toEqual([
      [0, 2],
      [2, 0],
    ]);
  });
});

describe("bytt innhold på tavla (21.1)", () => {
  it("datoene står, de to bytter, resten står, og samme bytte angrer", async () => {
    await fire();
    expect(await byttInnhold(await rekke(), 0, 2)).toBe(true);
    expect((await rekke()).map((o) => o.tema)).toEqual(["C", "B", "A", "D"]);
    await byttInnhold(await rekke(), 0, 2);
    expect((await rekke()).map((o) => o.tema)).toEqual(["A", "B", "C", "D"]);
  });

  it("perioden står, men mål og vurdering følger temaet, med fristen", async () => {
    const [a, b, c] = await fire();
    const p = await opprettPeriode(fag, "Revolusjoner", null, null, 1);
    await fargelegg([a, b, c], p);
    await settOktmal(c, "KM1", true);
    const v = await opprettVurdering(fag, KARAKTER, "Prøve", "skriftlig", null);
    await knyttOkt(v, c); // frist blir 3.9

    await byttInnhold(await rekke(), 2, 0);
    const etter = await rekke();
    expect(etter.map((o) => o.tema)).toEqual(["C", "B", "A", "D"]);
    expect(etter.map((o) => o.periodeId)).toEqual([p, p, p, null]);
    const mal = await hent<{ okt: string }>(
      "SELECT okt_id AS okt FROM okt_kompetansemal WHERE slettet IS NULL",
    );
    expect(mal.map((m) => m.okt)).toEqual([a]);
    const vo = await hent<{ okt: string }>(
      "SELECT okt_id AS okt FROM vurdering_okt WHERE slettet IS NULL",
    );
    expect(vo.map((x) => x.okt)).toEqual([a]);
    const [{ frist }] = await hent<{ frist: string }>(
      "SELECT frist FROM vurdering WHERE id = $1",
      [v],
    );
    expect(frist).toBe("2026-09-01");
  });

  it("en skåret økt ligger fast", async () => {
    const [, b] = await fire();
    const { opprettElev, koblePaFag } = await import("./elever");
    const tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fag);
    await settSkaring(tony, b, "5ca1ade1-0001-4000-8000-000000000004");
    expect(await byttInnhold(await rekke(), 1, 3)).toBe(false);
    expect(await byttInnhold(await rekke(), 0, 2)).toBe(true);
  });
});

describe("plassering i nabokolonnen (21.1)", () => {
  it("tar med de grå øktene imellom, og bare til naboen", async () => {
    const [a, b, c, d] = await fire();
    const p = await opprettPeriode(fag, "P1", null, null, 1);
    const q = await opprettPeriode(fag, "P2", null, null, 2);
    await fargelegg([a], p);
    await fargelegg([d], q);
    const k = kolonner(lagStripe(await rekke(), []), await hentPerioder(fag));
    // [P1: a] [grå: b, c] [P2: d]
    expect(tilKolonne(k, c, 0)?.map((e) => [e.oktId, e.til])).toEqual([
      [b, p],
      [c, p],
    ]);
    expect(tilKolonne(k, b, 2)?.map((e) => [e.oktId, e.til])).toEqual([
      [b, q],
      [c, q],
    ]);
    expect(tilKolonne(k, a, 2)).toBeNull();
  });
});

describe("kolonnene (21.1)", () => {
  it("deler der perioden skifter, og ferier står før økta etter", async () => {
    const [a, b, c, d] = await fire();
    const p = await opprettPeriode(fag, "P1", null, null, 1);
    const q = await opprettPeriode(fag, "P2", null, null, 2);
    await fargelegg([a, b], p);
    await fargelegg([d], q);
    const stripe = lagStripe(await rekke(), [
      {
        id: "f",
        skolearId: ar,
        navn: "Høstferie",
        type: "ferie",
        fra: "2026-09-02",
        til: "2026-09-02",
      },
    ]);
    // 2.9 har økt, så ferien gir ingen plass der.
    const k = kolonner(stripe, await hentPerioder(fag));
    expect(k.map((x) => x.periode?.navn ?? null)).toEqual(["P1", null, "P2"]);
    expect(k.map((x) => x.okter.length)).toEqual([2, 1, 1]);
    expect(c).toBe(k[1].okter[0].id);
  });
});
