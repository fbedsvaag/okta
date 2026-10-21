import { describe, expect, it } from "vitest";
import {
  gruppeTeams,
  navnelister,
  tegnGruppebilde,
  type Gruppesett,
  type Tegneflate,
} from "./gruppebilde";
import { PULTFARGER } from "./pultfarger";

/** Et lerret som husker alle farger og all tekst som ble tegnet. */
function opptak() {
  const farger: string[] = [];
  const tekst: string[] = [];
  const x = {
    set fillStyle(v: string) {
      farger.push(String(v).toLowerCase());
    },
    get fillStyle() {
      return "";
    },
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect() {},
    fillText(t: string) {
      tekst.push(t);
    },
    measureText(t: string) {
      return { width: t.length * 10 };
    },
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    save() {},
    restore() {},
    clip() {},
  } as unknown as Tegneflate;
  return { x, farger, tekst };
}

// Elever med innsats og fravær — det skal aldri nå fram til bildet.
const elever = [
  [
    { fornavn: "Tony", etternavn: "Soprano", innsats: 0.1, borte: true },
    { fornavn: "Paulie", etternavn: "Gualtieri", innsats: 0.9, borte: false },
  ],
  [
    { fornavn: "Tony", etternavn: "Blundetto", innsats: 0.5, borte: false },
    { fornavn: "Meadow", etternavn: "Soprano", innsats: 0.3, borte: false },
  ],
];

const sett = (valg: "fullt" | "fe" | "f"): Gruppesett => {
  const navn = navnelister(elever, valg);
  return {
    overskrift: "Veggavis",
    undertittel: "MFL2 · 2 grupper",
    dato: "21. oktober",
    grupper: navn.map((n, i) => ({ nr: i + 1, farge: PULTFARGER[i], navn: n })),
  };
};

describe("navnene (25.9)", () => {
  it("Fullt, Fornavn + E. og Fornavn (med initial når to heter det samme)", () => {
    expect(navnelister(elever, "fullt")[0]).toEqual([
      "Tony Soprano",
      "Paulie Gualtieri",
    ]);
    expect(navnelister(elever, "fe")[0]).toEqual(["Tony S.", "Paulie G."]);
    expect(navnelister(elever, "f")).toEqual([
      ["Tony S.", "Paulie"],
      ["Tony B.", "Meadow"],
    ]);
  });
});

describe("bilde til elevene (25.9)", () => {
  it("tegner gruppene og navnene, uten en eneste trafikklysfarge", () => {
    const { x, farger, tekst } = opptak();
    tegnGruppebilde(x, sett("fe"));
    for (const t of ["#3f9d49", "#d9a92f", "#c04a3d"])
      expect(farger.some((f) => f.startsWith(t))).toBe(false);
    expect(tekst).toContain("Veggavis");
    expect(tekst).toContain("Gruppe 2");
    expect(tekst).toContain("Paulie G.");
    expect(tekst.join(" ")).not.toMatch(/innsats|borte|0\.1|0\.9/i);
  });

  it("tar ikke imot elevobjekter med innsats", () => {
    const { x } = opptak();
    tegnGruppebilde(x, {
      overskrift: "x",
      // @ts-expect-error — innsats finnes ikke i det bildet får
      grupper: [{ nr: 1, farge: "#4f7ac0", navn: [], innsats: 0.2 }],
    });
  });
});

describe("Teams som tabell (25.10)", () => {
  it("har tabell og ren tekst, aldri innsats eller fravær", () => {
    const { html, tekst } = gruppeTeams(sett("fe"));
    expect(html).toContain("<table>");
    expect(html).toContain("■</span> Gruppe 1");
    expect(tekst).toContain("Gruppe 1: Tony S., Paulie G.");
    for (const ut of [html, tekst]) {
      expect(ut).not.toMatch(/innsats|borte|fravær|#3f9d49|#d9a92f|#c04a3d/i);
      expect(ut).not.toContain("Soprano");
    }
  });
});
