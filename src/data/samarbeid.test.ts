import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { filtrer, samarbeidFra } from "./samarbeid";
import { fordelGrupper } from "./fordeling";
import type { Oppsett } from "./klassekart";

const rad = (elevId: string, gruppe: number | null, plass: number | null) => ({
  elevId,
  gruppe,
  plass,
  gruppenavn: null,
  last: false,
});
const o = (id: string, tid: string, rader: Oppsett["rader"]): Oppsett => ({
  id,
  tid,
  navn: id,
  rader,
});

describe("samarbeid (26.1–26.4)", () => {
  const oppsett = [
    {
      type: "gruppe" as const,
      o: o("Kildeoppgave", "2026-10-14", [
        rad("tony", 0, null),
        rad("paulie", 0, null),
        rad("meadow", 1, null),
      ]),
    },
    {
      type: "gruppe" as const,
      o: o("Veggavis", "2026-10-20", [
        rad("tony", 1, null),
        rad("paulie", 1, null),
        rad("meadow", 0, null),
      ]),
    },
    {
      type: "plass" as const,
      o: o("Kart", "2026-09-01", [
        rad("tony", null, 1),
        rad("meadow", null, 2),
        rad("paulie", null, 3),
      ]),
    },
  ];
  // Plass 1 og 2 er makkere; 3 står alene.
  const pult = new Set(["1|2"]);

  it("teller grupper og sidemann, nyeste først", () => {
    const s = samarbeidFra(oppsett, "tony", pult);
    expect(s.get("paulie")!.map((h) => h.navn)).toEqual([
      "Veggavis",
      "Kildeoppgave",
    ]);
    expect(s.get("meadow")!.map((h) => h.type)).toEqual(["sidemann"]);
    expect(filtrer(s.get("meadow")!, "grupper")).toEqual([]);
  });
});

describe("«Sett sammen neste gang» er en myk regel (26.3)", () => {
  it("setter eleven i gruppe med en av dem hen aldri har vært med", () => {
    const elever = ["a", "b", "c", "d", "e", "f"].map((id) => ({
      id,
      kjonn: null,
      innsats: 0.5,
    }));
    for (let fro = 1; fro <= 8; fro++) {
      const r = fordelGrupper({
        elever,
        antall: 3,
        laste: new Map(),
        holdFra: [],
        historikk: new Map(),
        modus: "tilfeldig",
        bland: false,
        unnga: false,
        frø: fro,
        sammen: new Map([["a", new Set(["f"])]]),
      });
      const g = r.grupper.find((x) => x.includes("a"))!;
      expect(g).toContain("f");
    }
  });
});

describe("bare for læreren (26.6)", () => {
  it("ingen modul som skriver ut av appen, bruker samarbeidet", () => {
    const mappe = import.meta.dirname;
    const ut = [
      "arkiv.ts",
      "arsplaneksport.ts",
      "arsplandocx.ts",
      "ical.ts",
      "caldav.ts",
      "samtale.ts",
      "gruppebilde.ts",
      "karttegning.ts",
      "oppsettfil.ts",
      "json.ts",
    ].filter((f) => readdirSync(mappe).includes(f));
    expect(ut.length).toBeGreaterThan(5);
    for (const f of ut) {
      const kode = readFileSync(join(mappe, f), "utf8");
      expect(kode, f).not.toMatch(/samarbeid/i);
    }
  });
});
