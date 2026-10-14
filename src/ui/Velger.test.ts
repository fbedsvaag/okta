import { describe, expect, it } from "vitest";
import { hopp, rader, sok, type Valg } from "./Velger";

const v = (tekst: string, gruppe?: string): Valg => ({
  verdi: tekst,
  tekst,
  gruppe,
});

describe("rader", () => {
  it("setter overskrift der en gruppe begynner", () => {
    const r = rader([
      v("Ingen"),
      v("A", "HIS3"),
      v("B", "HIS3"),
      v("C", "Tidligere"),
    ]);
    expect(r.map((x) => x.type)).toEqual([
      "valg",
      "gruppe",
      "valg",
      "valg",
      "gruppe",
      "valg",
    ]);
  });

  it("setter et skille der valg uten gruppe følger en gruppe", () => {
    const r = rader([v("A", "Fag"), v("Ny")]);
    expect(r.map((x) => x.type)).toEqual(["gruppe", "valg", "skille", "valg"]);
  });

  it("gir hvert valg nummeret sitt i lista", () => {
    const r = rader([v("A", "X"), v("B", "Y")]);
    expect(r.flatMap((x) => (x.type === "valg" ? [x.nr] : []))).toEqual([0, 1]);
  });
});

describe("sok", () => {
  it("finner i tekst, hint og gruppe, uten hensyn til store bokstaver", () => {
    const valg = [
      { ...v("Muntlig: industrialisering", "HIS3"), hint: "12.11" },
      v("Skriftlig prøve", "NOR3"),
    ];
    expect(sok(valg, "INDUSTRI")).toHaveLength(1);
    expect(sok(valg, "12.11")).toHaveLength(1);
    expect(sok(valg, "nor3")).toHaveLength(1);
    expect(sok(valg, "  ")).toHaveLength(2);
  });
});

describe("hopp", () => {
  const valg = [
    v("Ferie"),
    v("Planleggingsdag"),
    v("Hendelse"),
    v("Helligdag"),
  ];

  it("går til neste valg som begynner på bokstaven", () => {
    expect(hopp(valg, 0, "h")).toBe(2);
    expect(hopp(valg, 2, "H")).toBe(3);
  });

  it("begynner forfra når den når slutten", () => {
    expect(hopp(valg, 3, "h")).toBe(2);
  });

  it("blir stående når ingen passer", () => {
    expect(hopp(valg, 1, "x")).toBe(1);
  });
});
