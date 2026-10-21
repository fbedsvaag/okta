import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const o = await import("./onsker");
const { opprettElev, slettElevHelt } = await import("./elever");
const { opprettSkolear } = await import("./skolear");
const { leggFagIAr } = await import("./fag");

let tony = "";
let paulie = "";
let meadow = "";
let fag = "";

beforeEach(async () => {
  base.nullstill();
  const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(ar, "HIS3", "Historie", null);
  tony = await opprettElev("Tony", "Soprano");
  paulie = await opprettElev("Paulie", "Gualtieri");
  meadow = await opprettElev("Meadow", "Soprano");
});

describe("ønsker (26.7–26.8)", () => {
  it("legges til én gang, kan være gjensidige, og fjernes", async () => {
    const id = await o.leggTilOnske(tony, paulie, "eleven");
    expect(await o.leggTilOnske(tony, paulie, "samtale")).toBe(id);
    expect(await o.leggTilOnske(tony, tony, "selv")).toBeNull();
    await o.leggTilOnske(paulie, tony, "samtale");
    expect(o.gjensidig(await o.hentOnsker(), tony, paulie)).toBe(true);
    await o.fjernOnske(id!);
    expect(o.gjensidig(await o.hentOnsker(), tony, paulie)).toBe(false);
  });
});

describe("avtaler (26.13)", () => {
  it("brukes når de er oppfylt, og blir stående ellers", async () => {
    await o.leggTilAvtale({
      elevId: tony,
      medElevId: paulie,
      skolearFagId: fag,
      gjelder: "begge",
      kilde: "eleven",
    });
    await o.leggTilAvtale({
      elevId: tony,
      medElevId: meadow,
      skolearFagId: fag,
      gjelder: "grupper",
      kilde: "jeg",
    });
    const a = await o.hentAvtaler(fag);
    expect(a).toHaveLength(2);
    expect(a.filter((x) => o.gjelderFor(x, "klassekart"))).toHaveLength(1);
    const n = await o.brukAvtaler(a, (x, y) => [x, y].includes(paulie));
    expect(n).toBe(1);
    expect((await o.hentAvtaler(fag)).map((x) => x.medElevId)).toEqual([
      meadow,
    ]);
  });
});

describe("sletting av en elev (26.8)", () => {
  it("tar ønskene og avtalene begge veier", async () => {
    await o.leggTilOnske(tony, paulie, "eleven");
    await o.leggTilOnske(paulie, tony, "eleven");
    await o.leggTilOnske(paulie, meadow, "eleven");
    await o.leggTilAvtale({
      elevId: paulie,
      medElevId: tony,
      skolearFagId: fag,
      gjelder: "begge",
      kilde: "jeg",
    });
    await slettElevHelt(tony);
    const igjen = await base.select<{ n: number }[]>(
      `SELECT (SELECT COUNT(*) FROM elevonske WHERE slettet IS NULL) +
              (SELECT COUNT(*) FROM neste_sammen WHERE slettet IS NULL) AS n`,
    );
    expect(igjen[0].n).toBe(1);
  });
});

describe("bare for læreren (26.11)", () => {
  it("ingen modul som skriver ut av appen, leser ønsker eller avtaler", () => {
    const mappe = import.meta.dirname;
    const ut = [
      "arkiv.ts",
      "arsplaneksport.ts",
      "arsplandocx.ts",
      "arsplanark.ts",
      "ical.ts",
      "caldav.ts",
      "samtale.ts",
      "gruppebilde.ts",
      "karttegning.ts",
      "oppsettfil.ts",
      "json.ts",
      "innsyn.ts",
    ].filter((f) => readdirSync(mappe).includes(f));
    expect(ut.length).toBeGreaterThan(6);
    for (const f of ut) {
      const kode = readFileSync(join(mappe, f), "utf8");
      expect(kode, f).not.toMatch(/elevonske|neste_sammen|onsker|relasjon/i);
    }
  });
});
