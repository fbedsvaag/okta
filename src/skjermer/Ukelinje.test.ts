import { describe, expect, it } from "vitest";
import {
  fordelPaBaner,
  leggTil,
  mandagFor,
  spennet,
  ukeTekst,
} from "./Ukelinje";
import type { Okt } from "../data/okter";

function okt(over: Partial<Okt>): Okt {
  return {
    id: Math.random().toString(36).slice(2),
    kode: null,
    skolearFagId: "sf",
    fagKode: "MFL1",
    fagNavn: "F",
    farge: null,
    periodeId: null,
    dato: "2026-08-11",
    klokkeslett: "09:15",
    varighetMin: 120,
    tema: null,
    sted: null,
    agenda: null,
    lekse: null,
    endret: "2026-08-01T00:00:00",
    plan: null,
    logg: null,
    kladd: null,
    skaret: 0,
    elever: 0,
    gronn: 0,
    gul: 0,
    rod: 0,
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

describe("uker", () => {
  it("finner mandagen i uka", () => {
    expect(mandagFor("2026-09-30")).toBe("2026-09-28");
    expect(mandagFor("2026-09-28")).toBe("2026-09-28");
    expect(mandagFor("2026-10-04")).toBe("2026-09-28"); // søndag
  });

  it("skriver ukenummer og spennet mandag–fredag", () => {
    expect(ukeTekst("2026-09-28")).toBe("Uke 40 · 28. sep – 2. okt");
  });

  it("går over månedsskiftet", () => {
    expect(leggTil("2026-09-28", 4)).toBe("2026-10-02");
  });
});
