import { describe, expect, it } from "vitest";
import type { Ark, Arkbolk, Arkrad } from "./arsplanark";
import { bolkerMedFerier, delISider, innholdshoyde, MAL } from "./arsplansider";

function rad(dato: string): Arkrad {
  return {
    oktId: dato,
    dato,
    uke: 0,
    klokkeslett: null,
    varighetMin: 90,
    tema: null,
    lekse: null,
    sted: null,
    agenda: null,
    vurderinger: [],
    vurderingType: null,
    mal: [],
    utenfor: false,
  };
}

function bolk(navn: string | null, datoer: string[]): Arkbolk {
  return {
    navn,
    farge: null,
    periodeId: navn,
    malNr: [],
    rader: datoer.map(rad),
    timer: 0,
    mal: [],
  };
}

function ark(bolker: Arkbolk[], ferier: Ark["ferier"] = []): Ark {
  return { bolker, ferier, liggende: false } as unknown as Ark;
}

const dager = (n: number, fra = 1) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 17 + i + fra));
    return d.toISOString().slice(0, 10);
  });

describe("ferier i tabellen", () => {
  it("står foran første økt etter ferien, i perioden før når en ny periode begynner", () => {
    const a = ark(
      [
        bolk("A", ["2026-09-21", "2026-09-24"]),
        bolk("B", ["2026-10-05", "2026-10-08"]),
      ],
      [
        { navn: "Høstferie", fra: "2026-09-28", til: "2026-10-02" },
        { navn: "Juleferie", fra: "2026-12-21", til: "2027-01-01" },
      ],
    );
    const b = bolkerMedFerier(a);
    expect(b[0].elementer.map((e) => e.type)).toEqual(["rad", "rad", "ferie"]);
    expect(b[0].elementer[2]).toMatchObject({ navn: "Høstferie", uke: 40 });
    // Etter siste økt: ingenting.
    expect(b[1].elementer.map((e) => e.type)).toEqual(["rad", "rad"]);
  });
});

describe("sider", () => {
  it("får plass på én side når det er lite", () => {
    expect(delISider(ark([bolk("A", dager(5))]), 400)).toHaveLength(1);
  });

  it("deler en lang periode, og skriver «fortsetter» på neste side", () => {
    const n = 60;
    const sider = delISider(ark([bolk("A", dager(n))]), 400);
    expect(sider.length).toBe(2);
    const forste = sider[0].elementer;
    const andre = sider[1].elementer;
    expect(forste[0]).toMatchObject({ type: "periode", fortsetter: false });
    expect(andre[0]).toMatchObject({ type: "periode", fortsetter: true });
    const rader = (s: typeof forste) =>
      s.filter((e) => e.type === "rad").length;
    expect(rader(forste) + rader(andre)).toBe(n);
    // Første side er full: én rad til ville gått over.
    const brukt = 400 + MAL.kolonnehode + MAL.periode + rader(forste) * MAL.rad;
    expect(brukt).toBeLessThanOrEqual(innholdshoyde(false));
    expect(brukt + MAL.rad).toBeGreaterThan(innholdshoyde(false));
  });

  it("lar ikke en periodeoverskrift stå alene nederst", () => {
    const plass = innholdshoyde(false) - 400 - MAL.kolonnehode - MAL.periode;
    const fyll = Math.floor(plass / MAL.rad);
    const sider = delISider(
      ark([bolk("A", dager(fyll)), bolk("B", dager(3, 80))]),
      400,
    );
    const forste = sider[0].elementer;
    expect(forste[forste.length - 1].type).toBe("rad");
    expect(sider[1].elementer[0]).toMatchObject({
      type: "periode",
      fortsetter: false,
    });
  });
});
