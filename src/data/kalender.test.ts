import { describe, expect, it } from "vitest";
import {
  blokkering,
  iso,
  lagSerie,
  paaskedag,
  roddager,
  roddagerISpenn,
  rodekart,
  ukenummer,
  type Fridag,
} from "./kalender";

// iso() og ikke toISOString(): sistnevnte går via UTC og flytter datoen
// en dag bakover i norsk sommertid.
const dato = iso;

describe("påsken", () => {
  // Fasit fra kalenderen. Treffer disse, treffer også alt som henger på dem.
  it.each([
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
  ])("1. påskedag %i er %s", (ar, forventet) => {
    expect(dato(paaskedag(ar))).toBe(forventet);
  });
});

describe("røde dager", () => {
  it("har tolv dager i året", () => {
    expect(roddager(2027)).toHaveLength(12);
  });

  it("plasserer de bevegelige riktig i 2027", () => {
    const kart = new Map(roddager(2027).map((r) => [r.navn, r.dato]));
    expect(kart.get("1. påskedag")).toBe("2027-03-28");
    expect(kart.get("Skjærtorsdag")).toBe("2027-03-25");
    expect(kart.get("Langfredag")).toBe("2027-03-26");
    expect(kart.get("2. påskedag")).toBe("2027-03-29");
    expect(kart.get("Kristi himmelfartsdag")).toBe("2027-05-06");
    expect(kart.get("1. pinsedag")).toBe("2027-05-16");
    expect(kart.get("2. pinsedag")).toBe("2027-05-17"); // sammenfaller med 17. mai
  });

  it("tar med begge årene i et skoleår", () => {
    const spenn = roddagerISpenn("2026-08-17", "2027-06-20");
    const navn = spenn.map((r) => r.navn);
    expect(navn).toContain("1. juledag");
    expect(navn).toContain("Nyttårsdag");
    expect(navn).toContain("17. mai");
    // Skoleåret starter i august, så mai og 17. mai i 2026 skal ikke med.
    expect(spenn.every((r) => r.dato >= "2026-08-17")).toBe(true);
  });
});

describe("serieopprettelse", () => {
  const ferie = (navn: string, fra: string, til: string): Fridag => ({
    id: navn,
    skolearId: "ar",
    navn,
    type: "ferie",
    fra,
    til,
  });

  it("finner alle tirsdager i spennet", () => {
    const serie = lagSerie(2, "2026-08-17", "2026-09-15", []);
    expect(serie.map((s) => s.dato)).toEqual([
      "2026-08-18",
      "2026-08-25",
      "2026-09-01",
      "2026-09-08",
      "2026-09-15",
    ]);
    expect(serie.every((s) => s.valgt)).toBe(true);
  });

  it("hopper over ferier, men viser dem", () => {
    const serie = lagSerie(2, "2026-09-22", "2026-10-13", [
      ferie("Høstferie", "2026-09-28", "2026-10-02"),
    ]);

    const hoppet = serie.filter((s) => s.hoppet !== null);
    expect(hoppet).toHaveLength(1);
    expect(hoppet[0].dato).toBe("2026-09-29");
    expect(hoppet[0].forklaring).toBe("Høstferie");
    expect(hoppet[0].valgt).toBe(false);

    // De andre står igjen, og ingenting er slettet fra lista.
    expect(serie).toHaveLength(4);
    expect(serie.filter((s) => s.valgt)).toHaveLength(3);
  });

  it("hopper over røde dager og sier hvilken", () => {
    // 2. påskedag 2027 er mandag 29. mars.
    const serie = lagSerie(1, "2027-03-22", "2027-04-05", []);
    const paske = serie.find((s) => s.dato === "2027-03-29");
    expect(paske?.hoppet).toBe("helligdag");
    expect(paske?.forklaring).toBe("2. påskedag");
  });

  it("skiller planleggingsdager fra ferier", () => {
    const serie = lagSerie(1, "2026-08-10", "2026-08-24", [
      {
        id: "p",
        skolearId: "ar",
        navn: "Planleggingsdag",
        type: "planlegging",
        fra: "2026-08-17",
        til: "2026-08-17",
      },
    ]);
    expect(serie.find((s) => s.dato === "2026-08-17")?.hoppet).toBe("planlegging");
  });

  it("gir tom liste når ukedagen ikke finnes i spennet", () => {
    expect(lagSerie(3, "2026-08-17", "2026-08-18", [])).toHaveLength(0);
  });

  it("teller riktig over et helt skoleår", () => {
    const serie = lagSerie(2, "2026-08-17", "2027-06-20", [
      ferie("Høstferie", "2026-09-28", "2026-10-02"),
      ferie("Juleferie", "2026-12-21", "2027-01-01"),
      ferie("Vinterferie", "2027-02-22", "2027-02-26"),
      ferie("Påskeferie", "2027-03-22", "2027-03-29"),
    ]);

    const okter = serie.filter((s) => s.valgt).length;
    expect(serie.length).toBeGreaterThan(okter);
    expect(okter).toBeGreaterThan(30);
    expect(okter).toBeLessThan(45);
  });
});

describe("blokkering", () => {
  const rode = rodekart("2026-08-01", "2027-07-31");
  const ferier: Fridag[] = [
    {
      id: "h",
      skolearId: "ar",
      navn: "Høstferie",
      type: "ferie",
      fra: "2026-09-28",
      til: "2026-10-02",
    },
  ];

  it("sier fra om helg", () => {
    expect(blokkering("2026-08-22", ferier, rode)?.type).toBe("helg");
  });

  it("sier fra om røde dager med navn", () => {
    expect(blokkering("2026-12-25", ferier, rode)).toEqual({
      navn: "1. juledag",
      type: "helligdag",
    });
  });

  it("sier fra om ferier med navn", () => {
    expect(blokkering("2026-09-30", ferier, rode)).toEqual({
      navn: "Høstferie",
      type: "ferie",
    });
  });

  it("gir null på en helt vanlig skoledag", () => {
    expect(blokkering("2026-08-18", ferier, rode)).toBeNull();
  });

  it("sier fra om en hendelse, med sin egen type", () => {
    // «Eksamen i annet fag» er ikke fri — skolen går — men timen blir det
    // ikke noe av. Egen type, så kalenderen kan vise den for seg.
    const eksamen: Fridag[] = [
      {
        id: "e",
        skolearId: "ar",
        navn: "Eksamen i norsk",
        type: "hendelse",
        fra: "2026-11-24",
        til: "2026-11-24",
      },
    ];
    expect(blokkering("2026-11-24", eksamen, rode)).toEqual({
      navn: "Eksamen i norsk",
      type: "hendelse",
    });
  });
});

describe("hendelser blokkerer undervisning", () => {
  it("hopper over hendelsesdager i en serie, som en ferie", () => {
    const eksamen: Fridag[] = [
      {
        id: "e",
        skolearId: "ar",
        navn: "Eksamen i norsk",
        type: "hendelse",
        fra: "2026-11-24",
        til: "2026-11-24",
      },
    ];
    // Tirsdager i spennet: 17., 24. november og 1. desember.
    const serie = lagSerie(2, "2026-11-17", "2026-12-01", eksamen);
    const valgte = serie.filter((d) => d.valgt).map((d) => d.dato);

    expect(valgte).toEqual(["2026-11-17", "2026-12-01"]);
    expect(serie.find((d) => d.dato === "2026-11-24")?.hoppet).toBe("hendelse");
  });
});

describe("ukenummer", () => {
  it.each([
    ["2026-01-01", 1],
    ["2026-08-17", 34],
    ["2026-12-28", 53],
    ["2027-01-04", 1],
    ["2027-05-17", 20],
    // 1. januar 2027 er en fredag og hører til uke 53 i 2026.
    ["2027-01-01", 53],
  ])("%s er uke %i", (dato, forventet) => {
    expect(ukenummer(dato)).toBe(forventet);
  });

  it("gir samme uke for hele mandag–søndag", () => {
    const uker = [
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ].map(ukenummer);
    expect(new Set(uker).size).toBe(1);
  });
});
