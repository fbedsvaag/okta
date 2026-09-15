import { describe, expect, it } from "vitest";
import { BANER, fordelPaBaner, kappBaner, spennet } from "./Ukelinje";
import type { Okt } from "../data/okter";

function okt(over: Partial<Okt>): Okt {
  return {
    id: Math.random().toString(36).slice(2),
    kode: null, skolearFagId: "sf", fagKode: "MFL1", fagNavn: "F",
    farge: null, periodeId: null, dato: "2026-08-11", klokkeslett: "09:15",
    varighetMin: 120, tema: null, sted: null, agenda: null,
    endret: "2026-08-01T00:00:00", plan: null, logg: null,
    skaret: 0, elever: 0, gronn: 0, gul: 0, rod: 0,
    ...over,
  };
}

describe("spennet", () => {
  it("regner klokkeslett og varighet til timer på aksen", () => {
    expect(spennet(okt({ klokkeslett: "09:15", varighetMin: 90 }), 8)).toEqual([
      9.25, 10.75,
    ]);
  });

  it("legger økter uten klokkeslett først på aksen, én time bred", () => {
    // Må stemme med der Blokk tegner dem, ellers legges to slike oppå
    // hverandre uten at banefordelingen oppdager det.
    expect(spennet(okt({ klokkeslett: null }), 8)).toEqual([8, 9]);
    expect(spennet(okt({ klokkeslett: null }), 7)).toEqual([7, 8]);
  });
});

describe("fordelPaBaner", () => {
  it("lar økter etter hverandre dele bane", () => {
    const baner = fordelPaBaner(
      [
        okt({ klokkeslett: "08:00", varighetMin: 60 }),
        okt({ klokkeslett: "10:00", varighetMin: 60 }),
      ],
      8,
    );
    expect(baner).toHaveLength(1);
    expect(baner[0]).toHaveLength(2);
  });

  it("skiller økter som overlapper", () => {
    const baner = fordelPaBaner(
      [
        okt({ klokkeslett: "08:00", varighetMin: 180 }),
        okt({ klokkeslett: "09:00", varighetMin: 60 }),
      ],
      8,
    );
    expect(baner).toHaveLength(2);
  });

  it("regner en økt som slutter der neste begynner som ikke-overlappende", () => {
    const baner = fordelPaBaner(
      [
        okt({ klokkeslett: "08:00", varighetMin: 60 }),
        okt({ klokkeslett: "09:00", varighetMin: 60 }),
      ],
      8,
    );
    expect(baner).toHaveLength(1);
  });

  it("legger to økter uten klokkeslett i hver sin bane", () => {
    const baner = fordelPaBaner(
      [okt({ klokkeslett: null }), okt({ klokkeslett: null })],
      8,
    );
    expect(baner).toHaveLength(2);
  });

  it("mister ingen økter", () => {
    const inn = [
      okt({ klokkeslett: "08:00", varighetMin: 240 }),
      okt({ klokkeslett: "09:00", varighetMin: 60 }),
      okt({ klokkeslett: "09:30", varighetMin: 60 }),
      okt({ klokkeslett: null }),
    ];
    expect(fordelPaBaner(inn, 8).flat()).toHaveLength(inn.length);
  });

  it("gir ingen baner for en dag uten økter", () => {
    expect(fordelPaBaner([], 8)).toEqual([]);
  });
});

describe("kappBaner", () => {
  // Poenget med kappingen er at dagraden er like høy uansett uke. Blir den
  // høyere når noe overlapper, flytter årsoversikten under seg (§4.1).
  it("lar alt stå når det får plass", () => {
    const baner = [[okt({})], [okt({})]];
    expect(kappBaner(baner, 2)).toEqual({ synlige: baner, skjulte: [] });
  });

  it("kapper det som ikke får plass og teller det opp", () => {
    const tredje = okt({ klokkeslett: "10:00" });
    const fjerde = okt({ klokkeslett: "11:00" });
    const { synlige, skjulte } = kappBaner(
      [[okt({})], [okt({})], [tredje], [fjerde]],
      2,
    );
    expect(synlige).toHaveLength(2);
    expect(skjulte).toEqual([tredje, fjerde]);
  });

  it("mister ingen økter — alt er enten synlig eller talt", () => {
    const baner = [[okt({})], [okt({})], [okt({}), okt({})], [okt({})]];
    const { synlige, skjulte } = kappBaner(baner, 2);
    expect(synlige.flat().length + skjulte.length).toBe(baner.flat().length);
  });

  it("tåler en dag uten økter", () => {
    expect(kappBaner([], 2)).toEqual({ synlige: [], skjulte: [] });
  });

  it("bruker banetaket som standard", () => {
    const baner = Array.from({ length: BANER + 1 }, () => [okt({})]);
    expect(kappBaner(baner).skjulte).toHaveLength(1);
  });
});
