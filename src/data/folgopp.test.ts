import { describe, expect, it } from "vitest";
import { byggFolgOpp, grunnerFraOkter, siden } from "./folgopp";
import type { Oktrad } from "./oktrader";

const rad = (
  elevId: string,
  oktId: string,
  dato: string,
  over: Partial<Oktrad> = {},
): Oktrad => ({
  elevId,
  skolearFagId: "f",
  oktId,
  dato,
  klokkeslett: "08:30",
  varighetMin: 90,
  tema: null,
  farge: "gronn",
  borte: 0,
  ikkeSett: 0,
  ...over,
});

describe("Følg opp", () => {
  it("finner rød sist, borte og ikke sett fra de siste øktene", () => {
    const g = grunnerFraOkter([
      rad("tony", "o1", "2026-10-01", { farge: "rod" }),
      rad("tony", "o2", "2026-10-08", { farge: "rod" }),
      rad("paulie", "o1", "2026-10-01"),
      rad("paulie", "o2", "2026-10-08", { borte: 1, farge: null }),
      rad("meadow", "o1", "2026-10-01", { ikkeSett: 1, farge: null }),
      rad("meadow", "o2", "2026-10-08", { ikkeSett: 1, farge: null }),
      rad("aj", "o1", "2026-10-01", { farge: "rod" }),
      rad("aj", "o2", "2026-10-08"),
    ]);
    expect(g.get("tony|f")?.[0]).toMatchObject({
      slag: "rod",
      tekst: "Rød de to siste øktene",
      nokkel: "rod:o2",
    });
    expect(g.get("paulie|f")?.[0].slag).toBe("borte");
    expect(g.get("meadow|f")?.[0].tekst).toMatch(/Ikke sett på 2 økter/);
    // Rød for to uker siden, grønn sist: ikke med.
    expect(g.has("aj|f")).toBe(false);
  });

  it("fulgt opp tar grunnen ut, og en ny økt tar den inn igjen", () => {
    const rader = [rad("tony", "o1", "2026-10-01", { farge: "rod" })];
    const tom = byggFolgOpp({
      rader,
      frister: [],
      avtaler: [],
      fulgt: new Set(["tony|rod:o1"]),
    });
    expect(tom).toEqual([]);
    const ny = byggFolgOpp({
      rader: [...rader, rad("tony", "o2", "2026-10-08", { farge: "rod" })],
      frister: [],
      avtaler: [],
      fulgt: new Set(["tony|rod:o1"]),
    });
    expect(ny).toHaveLength(1);
    expect(ny[0].innsats).toEqual(["rod", "rod"]);
  });

  it("tar med frister og avtaler, nyeste først", () => {
    const r = byggFolgOpp({
      rader: [],
      frister: [
        {
          elevId: "tony",
          skolearFagId: "f",
          vurderingId: "v",
          tittel: "Kampanjeplan",
          hva: "ikke",
          dato: "2026-10-01",
        },
      ],
      avtaler: [
        {
          id: "m",
          elevId: "paulie",
          tekst: "Spørre om hjelp",
          dato: "2026-10-20",
        },
      ],
      fulgt: new Set(),
    });
    expect(r.map((x) => x.elevId)).toEqual(["paulie", "tony"]);
    expect(r[0]).toMatchObject({ skolearFagId: null });
    expect(r[1].grunner[0].tekst).toMatch(/Kampanjeplan ikke levert/);
  });

  it("sier hvor lenge siden", () => {
    expect(siden("2026-10-22", "2026-10-22")).toBe("i dag");
    expect(siden("2026-10-16", "2026-10-22")).toBe("6 dager");
    expect(siden("2026-10-08", "2026-10-22")).toBe("2 uker");
  });
});
