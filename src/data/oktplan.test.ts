import { describe, expect, it } from "vitest";
import {
  folgOpp,
  iPerioden,
  lesPlan,
  nyttPunkt,
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
    // Det eldre formatet, fra før 15.8. Skal leses og skrives likt.
    const tekst =
      "- [x] Oppsummering · 10 min\n- [ ] Case i grupper · 60 min\n- [ ] Exit-lapp\nHusk projektor";
    const { punkter, rest } = lesPlan(tekst);
    expect(punkter).toEqual([
      nyttPunkt({ gjort: true, tekst: "Oppsummering", min: 10 }),
      nyttPunkt({ tekst: "Case i grupper", min: 60 }),
      nyttPunkt({ tekst: "Exit-lapp" }),
    ]);
    expect(rest).toEqual(["Husk projektor"]);
    expect(skrivPlan(punkter, rest)).toBe(tekst);
    expect(skrivPlan([], [])).toBeNull();
  });

  it("leser eldre planer med stjerne, store X og uten mellomrom", () => {
    const { punkter } = lesPlan("* [X]Gjennomgang · 30min\n  - [ ] Innrykket");
    expect(punkter.map((p) => [p.gjort, p.tekst, p.min])).toEqual([
      [true, "Gjennomgang", 30],
      [false, "Innrykket", null],
    ]);
  });

  const ny = [
    "- [ ] Gruppearbeid: kildekritikk · 30 min",
    "    Elevene får tre kilder hver.",
    "",
    "    Husk arkene.",
    "- Pause · 10 min",
    "- [x] Gjennomgang · 30 min · +5 min · ferdig 09:16",
    "- [ ] Film · 15 min",
  ].join("\n");

  it("leser beskrivelse, pause, forlengelse og ferdig-tid", () => {
    const { punkter, rest } = lesPlan(ny);
    expect(rest).toEqual([]);
    expect(punkter).toEqual([
      nyttPunkt({
        tekst: "Gruppearbeid: kildekritikk",
        min: 30,
        beskrivelse: "Elevene får tre kilder hver.\n\nHusk arkene.",
      }),
      nyttPunkt({ type: "pause", tekst: "Pause", min: 10 }),
      nyttPunkt({
        tekst: "Gjennomgang",
        min: 30,
        gjort: true,
        ferdig: "09:16",
        forlenget: 5,
      }),
      nyttPunkt({ tekst: "Film", min: 15 }),
    ]);
  });

  it("skriver det nye formatet tilbake uten å miste noe", () => {
    const { punkter, rest } = lesPlan(ny);
    expect(skrivPlan(punkter, rest)).toBe(ny);
  });

  it("tåler halen i en annen rekkefølge", () => {
    const [p] = lesPlan(
      "- [x] Gjennomgang · ferdig 9:05 · 30 min · +10 min",
    ).punkter;
    expect([p.tekst, p.min, p.ferdig, p.forlenget]).toEqual([
      "Gjennomgang",
      30,
      "9:05",
      10,
    ]);
  });

  it("lar en tittel med «·» i seg stå", () => {
    const [p] = lesPlan("- [ ] Ibsen · akt 2 · 20 min").punkter;
    expect([p.tekst, p.min]).toEqual(["Ibsen · akt 2", 20]);
  });

  it("skriver ikke ferdig-tid på et punkt som ikke er krysset av", () => {
    const p = nyttPunkt({ tekst: "A", min: 5, ferdig: "09:00" });
    expect(skrivPlan([p], [])).toBe("- [ ] A · 5 min");
  });

  it("lar fritekst etter punktene bli fritekst, ikke beskrivelse", () => {
    const { punkter, rest } = lesPlan("- [ ] A · 5 min\nHusk projektor");
    expect(punkter[0].beskrivelse).toBe("");
    expect(rest).toEqual(["Husk projektor"]);
  });

  it("summerer mot øktas lengde", () => {
    const p = lesPlan("- [ ] a · 60 min\n- [ ] b · 60 min").punkter;
    expect(plansum(p, 180)).toBe("2 t av 3 t");
    expect(plansum(lesPlan("- [ ] a · 40 min").punkter, 90)).toBe(
      "40 min av 1,5 t",
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
