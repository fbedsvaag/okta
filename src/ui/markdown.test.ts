import { describe, expect, it } from "vitest";
import {
  enterIListe,
  pakkInn,
  rykk,
  tolkInline,
  tolkMarkdown,
  vekslBoks,
} from "./markdown";

describe("tolkMarkdown", () => {
  it("kjenner overskrifter, lister og avsnitt", () => {
    const b = tolkMarkdown(
      "# Samtale\nTony var fornøyd.\n\n- Lekser\n- Fravær",
    );
    expect(b.map((x) => x.type)).toEqual(["overskrift", "avsnitt", "liste"]);
    const liste = b[2] as Extract<(typeof b)[number], { type: "liste" }>;
    expect(liste.punkter).toHaveLength(2);
    expect(liste.ordnet).toBe(false);
  });

  it("kjenner nummererte lister og startnummeret", () => {
    const [l] = tolkMarkdown("3. tre\n4. fire");
    expect(l).toMatchObject({ type: "liste", ordnet: true, start: 3 });
  });

  it("kjenner innrykk og avkrysningsbokser, og husker linja", () => {
    const [l] = tolkMarkdown("- [ ] Ring hjem\n  - [x] Sendt melding");
    if (l.type !== "liste") throw new Error();
    expect(l.punkter.map((p) => [p.niva, p.avkrysset, p.linje])).toEqual([
      [0, false, 0],
      [1, true, 1],
    ]);
  });

  it("lager ingen HTML av det som står i teksten", () => {
    const [a] = tolkMarkdown("<script>alert(1)</script>");
    expect(a).toEqual({
      type: "avsnitt",
      linjer: [[{ type: "tekst", tekst: "<script>alert(1)</script>" }]],
    });
  });
});

describe("tolkInline", () => {
  it("kjenner fet, kursiv og kode", () => {
    expect(tolkInline("**viktig** og *litt* og `kode`")).toEqual([
      { type: "fet", deler: [{ type: "tekst", tekst: "viktig" }] },
      { type: "tekst", tekst: " og " },
      { type: "kursiv", deler: [{ type: "tekst", tekst: "litt" }] },
      { type: "tekst", tekst: " og " },
      { type: "kode", tekst: "kode" },
    ]);
  });

  it("lar enkle stjerner og understreker i vanlig tekst være", () => {
    expect(tolkInline("3 * 4 = 12")).toEqual([
      { type: "tekst", tekst: "3 * 4 = 12" },
    ]);
    expect(tolkInline("fil_navn_her")).toEqual([
      { type: "tekst", tekst: "fil_navn_her" },
    ]);
  });
});

describe("enterIListe", () => {
  it("lager et nytt punkt med samme merke og innrykk", () => {
    const t = "  - første";
    expect(enterIListe(t, t.length)).toEqual({
      tekst: "  - første\n  - ",
      start: 15,
      slutt: 15,
    });
  });

  it("teller videre i nummererte lister", () => {
    const t = "1. første";
    expect(enterIListe(t, t.length)?.tekst).toBe("1. første\n2. ");
  });

  it("gir en ny tom avkrysningsboks", () => {
    const t = "- [x] ferdig";
    expect(enterIListe(t, t.length)?.tekst).toBe("- [x] ferdig\n- [ ] ");
  });

  it("avslutter lista på et tomt punkt", () => {
    const t = "- første\n- ";
    expect(enterIListe(t, t.length)).toEqual({
      tekst: "- første\n",
      start: 9,
      slutt: 9,
    });
  });

  it("gjør ingenting utenfor en liste", () => {
    expect(enterIListe("vanlig tekst", 5)).toBeNull();
  });
});

describe("rykk", () => {
  it("rykker listepunkter inn og ut", () => {
    const inn = rykk("- a\n- b", 0, 7, true)!;
    expect(inn.tekst).toBe("  - a\n  - b");
    expect(rykk(inn.tekst, 0, inn.tekst.length, false)!.tekst).toBe("- a\n- b");
  });

  it("lar vanlig tekst være — der gjør Tab det vanlige", () => {
    expect(rykk("tekst", 0, 5, true)).toBeNull();
  });
});

describe("pakkInn", () => {
  it("legger fet rundt markeringen, og tar den bort igjen", () => {
    const f = pakkInn("et ord her", 3, 6, "**");
    expect(f).toEqual({ tekst: "et **ord** her", start: 5, slutt: 8 });
    expect(pakkInn(f.tekst, f.start, f.slutt, "**").tekst).toBe("et ord her");
  });
});

describe("vekslBoks", () => {
  it("krysser av og fjerner avkrysningen på riktig linje", () => {
    const t = "- [ ] a\n- [ ] b";
    const en = vekslBoks(t, 1);
    expect(en).toBe("- [ ] a\n- [x] b");
    expect(vekslBoks(en, 1)).toBe(t);
  });
});
