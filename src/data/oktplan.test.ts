import type { Planpunkt } from "./oktplan";
import { describe, expect, it } from "vitest";
import {
  folgOpp,
  iPerioden,
  lesPlan,
  nyttPunkt,
  sumTekst,
  startTider,
  skiller,
  flyttTid,
  dragEnde,
  lengste,
  lesTittel,
  planMedPauser,
  borteSist,
  ikkeSettSist,
  livePlan,
  livetid,
  livetekst,
  narTekst,
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
    const p = (min: number) => nyttPunkt({ tekst: "x", min });
    expect(sumTekst([p(60), p(30)], 90)).toBe("90 av 90 min · går opp");
    expect(sumTekst([p(80)], 90)).toBe("80 av 90 min · 10 min luft");
    expect(sumTekst([p(60), p(40)], 90)).toBe("100 av 90 min · 10 min for mye");
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
    ikkeSett: 0,
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

describe("tida i planen", () => {
  const a = (min: number, tekst = "a") => nyttPunkt({ tekst, min });
  const pause = (min: number) =>
    nyttPunkt({ type: "pause", tekst: "Pause", min });

  it("regner ut når hvert punkt begynner", () => {
    expect(startTider([a(10), a(30), a(5)], "08:30")).toEqual([
      "08:30",
      "08:40",
      "09:10",
    ]);
    expect(startTider([a(10)], null)).toEqual([null]);
  });

  it("hopper over pauser i skillene, så de står fast", () => {
    const p = [a(10), pause(10), a(30)];
    // Begge skillene ved pausen flytter tid mellom aktivitetene rundt den.
    expect(skiller(p, null)).toEqual([
      { etter: 0, fra: 0, til: 2 },
      { etter: 1, fra: 0, til: 2 },
    ]);
    // Valgt pause: skillene endrer pausen selv.
    expect(skiller(p, 1)).toEqual([
      { etter: 0, fra: 0, til: 1 },
      { etter: 1, fra: 1, til: 2 },
    ]);
  });

  it("har ikke skille der det bare er pauser på den ene siden", () => {
    expect(skiller([pause(10), a(30)], null)).toEqual([]);
  });

  it("flytter tid i steg på fem, med minst fem igjen, og summen står", () => {
    const p = [a(30), a(30)];
    expect(flyttTid(p, 0, 1, 7).map((x) => x.min)).toEqual([35, 25]);
    expect(flyttTid(p, 0, 1, 100).map((x) => x.min)).toEqual([55, 5]);
    expect(flyttTid(p, 0, 1, -100).map((x) => x.min)).toEqual([5, 55]);
  });

  it("lar enden av siste bolk gi luft, men aldri fylle forbi slutt", () => {
    const p = [a(30), a(30)];
    expect(dragEnde(p, 90, 30, -10).map((x) => x.min)).toEqual([30, 20]);
    expect(dragEnde(p, 90, 30, 100).map((x) => x.min)).toEqual([30, 60]);
    // Allerede over: kan bare kortes ned.
    expect(dragEnde([a(60), a(40)], 90, 40, 10).map((x) => x.min)).toEqual([
      60, 40,
    ]);
  });

  it("finner den lengste aktiviteten, ikke pausen", () => {
    expect(lengste([a(10), pause(60), a(30)])).toBe(2);
    expect(lengste([pause(10)])).toBe(-1);
  });

  it("tar minuttene ut av tittelen", () => {
    expect(lesTittel("Film · 15 min")).toEqual({ tekst: "Film", min: 15 });
    expect(lesTittel("Film 15 min")).toEqual({ tekst: "Film", min: 15 });
    expect(lesTittel("Kapittel 3")).toEqual({ tekst: "Kapittel 3", min: null });
    expect(lesTittel("15 min")).toEqual({ tekst: "15 min", min: null });
  });
});

describe("live", () => {
  const a = (min: number, d: Partial<Planpunkt> = {}) =>
    nyttPunkt({ tekst: d.tekst ?? "a", min, ...d });
  const plan = [
    a(10, { tekst: "Repetisjon" }),
    a(30, { tekst: "Gjennomgang" }),
    nyttPunkt({ type: "pause", tekst: "Pause", min: 10 }),
    a(30, { tekst: "Gruppearbeid" }),
    a(10, { tekst: "Exit-lapp" }),
  ];

  it("krysser av det som er ferdig, og finner det som pågår", () => {
    const { liste, aktiv } = livePlan(plan, "08:30", 55);
    expect(aktiv).toBe(3);
    expect(liste.map((l) => l.ferdig)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(liste[0].auto).toBe(true);
  });

  it("lar +5 min flytte resten", () => {
    const p = plan.map((x, i) => (i === 1 ? { ...x, forlenget: 6 } : x));
    const { liste } = livePlan(p, "08:30", 61);
    expect(liste[4].e).toBe(96);
    const t = livetekst(p, "08:30", 90, 61);
    expect(t.under).toBe("6 min forlenget · siste går 6 min over");
    expect(livetid(p[4], liste[4], false, 61, "08:30", 90)).toBe(
      "6 min over slutt",
    );
  });

  it("starter neste når en aktivitet krysses av før tida", () => {
    const p = plan.map((x, i) =>
      i === 0 ? { ...x, gjort: true, ferdig: "08:36" } : x,
    );
    const { liste, aktiv } = livePlan(p, "08:30", 7);
    expect(liste[0]).toMatchObject({ e: 6, ferdig: true, auto: false });
    expect(aktiv).toBe(1);
  });

  it("sier hva som skjer før start og etter slutt", () => {
    expect(livetekst(plan, "08:30", 90, -12)).toMatchObject({
      etikett: "Starter om 12 min",
      tittel: "Først: Repetisjon",
      under: "4 aktiviteter, går opp",
    });
    expect(livetekst(plan, "08:30", 90, 92)).toMatchObject({
      etikett: "Ferdig 10:00",
      tittel: "4 av 4 aktiviteter krysset av",
      under: "Skriv i øktloggen før du lukker",
    });
  });

  it("viser tid igjen for den aktive og fra–til for resten", () => {
    const { liste } = livePlan(plan, "08:30", 55);
    expect(livetid(plan[3], liste[3], true, 55, "08:30", 90)).toBe(
      "25 min igjen",
    );
    expect(livetid(plan[4], liste[4], false, 55, "08:30", 90)).toBe(
      "09:50–10:00",
    );
    expect(livetid(plan[0], liste[0], false, 55, "08:30", 90)).toBe("08:40");
    expect(livetekst(plan, "08:30", 90, 55)).toMatchObject({
      hoyre: "5 av 30 min",
      under: "35 min igjen av økta",
      status: "Pågår · 35 min igjen",
    });
  });

  it("krysser bare av det som er klikket når økta er uten klokkeslett", () => {
    const { liste, aktiv } = livePlan(plan, null, null);
    expect(aktiv).toBe(-1);
    expect(liste.every((l) => !l.ferdig)).toBe(true);
  });
});

describe("standard pauser (17.5)", () => {
  it("deler økta med pause etter hver del, og resten i den siste", () => {
    expect(planMedPauser(90, 45, 10)).toBe(
      "- [ ] Del 1 · 45 min\n- Pause · 10 min\n- [ ] Del 2 · 35 min",
    );
    const lang = lesPlan(planMedPauser(195, 45, 10)).punkter;
    expect(lang.map((p) => p.min)).toEqual([45, 10, 45, 10, 45, 10, 30]);
    expect(lang.reduce((s, p) => s + (p.min ?? 0), 0)).toBe(195);
  });

  it("gir ingen plan uten pause, eller når økta er for kort", () => {
    expect(planMedPauser(90, null, 10)).toBeNull();
    expect(planMedPauser(50, 45, 10)).toBeNull();
  });
});

describe("borte sist", () => {
  const r = (
    elevId: string,
    oktId: string,
    dato: string,
    borte: number,
    kl = "08:30",
  ) => ({
    elevId,
    oktId,
    dato,
    klokkeslett: kl,
    borte,
    ikkeSett: 0,
    skolearFagId: "f",
    farge: borte ? null : "rod",
    varighetMin: 90,
    tema: null,
  });
  const okt = {
    id: "na",
    dato: "2026-10-20",
    klokkeslett: "08:30",
    skolearFagId: "f",
  };

  it("gir alle som var borte i forrige avholdte økt, også de røde", () => {
    const rader = [
      r("a", "o1", "2026-10-13", 1),
      r("a", "o2", "2026-10-15", 1),
      r("b", "o2", "2026-10-15", 1),
      r("c", "o2", "2026-10-15", 0),
    ];
    expect(borteSist(rader, okt)).toEqual({
      dato: "2026-10-15",
      elevIder: ["a", "b"],
    });
  });

  it("tar med en tidligere økt samme dag, men ikke denne", () => {
    const rader = [
      r("a", "o1", "2026-10-20", 1, "08:00"),
      r("b", "na", "2026-10-20", 1),
    ];
    expect(
      borteSist(rader, { ...okt, klokkeslett: "10:00" })?.elevIder,
    ).toEqual(["a"]);
  });

  it("er tom uten tidligere økter", () => {
    expect(borteSist([], okt)).toBeNull();
    expect(ikkeSettSist([], okt)).toEqual([]);
  });

  it("skiller borte fra ikke sett (19.4)", () => {
    const rader = [
      r("a", "o2", "2026-10-15", 1),
      { ...r("b", "o2", "2026-10-15", 0), farge: null, ikkeSett: 1 },
      r("c", "o2", "2026-10-15", 0),
    ];
    expect(borteSist(rader, okt)?.elevIder).toEqual(["a"]);
    expect(ikkeSettSist(rader, okt)).toEqual(["b"]);
  });
});
