import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr, endreFagIAr, hentFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { lagStripe } = await import("./aret");

describe("faginnstillinger (migrasjon 038)", () => {
  let ar = "";
  let fag = "";
  beforeEach(async () => {
    base.nullstill();
    ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    fag = await leggFagIAr(ar, "HIS3", "Historie", null);
  });

  it("lagrer ukedager og standardskala", async () => {
    const [s] = await base.select<{ id: string }[]>(
      "SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1",
    );
    await endreFagIAr(fag, { ukedager: [4, 1], vurderingsskala_id: s.id });
    const [f] = await hentFagIAr(ar);
    expect(f.ukedager).toEqual([1, 4]);
    expect(f.vurderingsskalaId).toBe(s.id);
    await endreFagIAr(fag, { ukedager: [] });
    expect((await hentFagIAr(ar))[0].ukedager).toBeNull();
  });

  it("et arkivert fag er borte fra årets fag, men kan hentes tilbake", async () => {
    await endreFagIAr(fag, { arkivert: "2026-10-22" });
    expect(await hentFagIAr(ar)).toEqual([]);
    const [f] = await hentFagIAr(ar, true);
    expect(f.arkivert).toBe("2026-10-22");
    await endreFagIAr(fag, { arkivert: null });
    expect(await hentFagIAr(ar)).toHaveLength(1);
  });
});

describe("Året med fagets dager", () => {
  const okt = (dato: string) =>
    ({ id: dato, dato, klokkeslett: "08:30" }) as never;
  const ferie = [
    {
      id: "h",
      navn: "Høstferie",
      type: "ferie",
      fra: "2026-10-05",
      til: "2026-10-09",
    },
  ] as never;

  it("ferieplasser på dagene satt for faget, ellers dagene fra øktene", () => {
    // Bare mandager i øktene; faget er satt til mandag og torsdag.
    const okter = [okt("2026-09-28"), okt("2026-10-12")];
    const fraOkter = lagStripe(okter, ferie).filter((p) => p.slag === "ferie");
    expect(fraOkter.map((p) => p.dato)).toEqual(["2026-10-05"]);
    const satt = lagStripe(okter, ferie, [1, 4]).filter(
      (p) => p.slag === "ferie",
    );
    expect(satt.map((p) => p.dato)).toEqual(["2026-10-05", "2026-10-08"]);
  });
});
