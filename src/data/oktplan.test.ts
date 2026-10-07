import { describe, expect, it } from "vitest";
import {
  folgOpp,
  iPerioden,
  lesPlan,
  narTekst,
  plansum,
  skrivPlan,
  standardModus,
} from "./oktplan";
import type { Oktrad } from "./oktrader";
import type { Okt } from "./okter";

const na = new Date("2026-10-07T10:00:00");

describe("modus", () => {
  it("åpner fram i tid i planlegging, ellers i skåring", () => {
    expect(
      standardModus({ dato: "2026-10-08", klokkeslett: "08:30" }, na),
    ).toBe("plan");
    expect(
      standardModus({ dato: "2026-10-07", klokkeslett: "12:30" }, na),
    ).toBe("plan");
    expect(
      standardModus({ dato: "2026-10-07", klokkeslett: "08:30" }, na),
    ).toBe("skaring");
    expect(
      standardModus({ dato: "2026-10-01", klokkeslett: "08:30" }, na),
    ).toBe("skaring");
  });

  it("sier når økta er", () => {
    expect(narTekst({ dato: "2026-10-10", klokkeslett: null }, na)).toBe(
      "om 3 dager",
    );
    expect(narTekst({ dato: "2026-10-08", klokkeslett: null }, na)).toBe(
      "i morgen",
    );
    expect(narTekst({ dato: "2026-10-07", klokkeslett: "12:30" }, na)).toBe(
      "i dag kl. 12:30",
    );
    expect(narTekst({ dato: "2026-10-06", klokkeslett: null }, na)).toBe(
      "i går",
    );
    expect(narTekst({ dato: "2026-10-02", klokkeslett: null }, na)).toBe(
      "for 5 dager siden",
    );
    expect(narTekst({ dato: "2026-11-07", klokkeslett: null }, na)).toBe(
      "om 4 uker",
    );
  });
});

describe("planen", () => {
  it("leser og skriver avkrysningspunkter med minutter, og beholder resten", () => {
    const tekst =
      "- [x] Oppsummering · 10 min\n- [ ] Case i grupper · 60 min\n- [ ] Exit-lapp\nHusk projektor";
    const { punkter, rest } = lesPlan(tekst);
    expect(punkter).toEqual([
      { gjort: true, tekst: "Oppsummering", min: 10 },
      { gjort: false, tekst: "Case i grupper", min: 60 },
      { gjort: false, tekst: "Exit-lapp", min: null },
    ]);
    expect(rest).toEqual(["Husk projektor"]);
    expect(skrivPlan(punkter, rest)).toBe(tekst);
    expect(skrivPlan([], [])).toBeNull();
  });

  it("summerer mot øktas lengde", () => {
    const p = lesPlan("- [ ] a · 60 min\n- [ ] b · 60 min").punkter;
    expect(plansum(p, 180)).toBe("2 t av 3");
    expect(plansum(lesPlan("- [ ] a · 40 min").punkter, 90)).toBe(
      "40 min av 1,5",
    );
  });
});

function rad(
  elevId: string,
  dato: string,
  farge: string | null,
  borte = 0,
): Oktrad {
  return {
    elevId,
    skolearFagId: "f",
    oktId: dato,
    dato,
    klokkeslett: null,
    varighetMin: 90,
    tema: null,
    farge,
    borte,
  };
}

describe("følg opp i økta", () => {
  it("tar med rød to ganger på rad, borte sist og åpne punkter", () => {
    const rader = [
      rad("chris", "2026-10-01", "rod"),
      rad("chris", "2026-10-05", "rod"),
      rad("vito", "2026-10-01", "gronn"),
      rad("vito", "2026-10-05", null, 1),
      rad("jackie", "2026-10-05", "gul"),
      rad("meadow", "2026-10-05", "gronn"),
      // Etter økta: teller ikke.
      rad("meadow", "2026-10-12", "rod"),
      rad("meadow", "2026-10-13", "rod"),
    ];
    const okt = { id: "x", dato: "2026-10-08", skolearFagId: "f" };
    expect(folgOpp(rader, okt, new Set(["jackie", "utenfor"]))).toEqual([
      { elevId: "chris", grunn: "rod" },
      { elevId: "vito", grunn: "borte" },
      { elevId: "jackie", grunn: "punkt" },
    ]);
  });
});

describe("perioden", () => {
  it("finner nummeret til økta i perioden", () => {
    const o = (id: string, dato: string, periodeId: string | null) =>
      ({ id, dato, klokkeslett: null, periodeId }) as Okt;
    const fag = [
      o("c", "2026-10-08", "p"),
      o("a", "2026-10-01", "p"),
      o("b", "2026-10-05", null),
    ];
    expect(iPerioden({ id: "c", periodeId: "p" }, fag)).toMatchObject({
      nr: 2,
      av: 2,
    });
    expect(iPerioden({ id: "b", periodeId: null }, fag)).toBeNull();
  });
});
