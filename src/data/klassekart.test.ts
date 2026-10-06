import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  opprettElev,
  koblePaFag,
  finnEllerOpprettKlasse,
  settKlasse,
  settMentor,
  slettElevHelt,
} = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, settSkaring } = await import("./okter");
const k = await import("./klassekart");

const IV = "5ca1ade1-0001-4000-8000-000000000001";
const ROD = "5ca1ade1-0001-4000-8000-000000000002";
const GRONN = "5ca1ade1-0001-4000-8000-000000000004";

let ar = "";
let fag = "";
let tony = "";
let meadow = "";

beforeEach(async () => {
  base.nullstill();
  ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
  tony = await opprettElev("Tony", "Soprano");
  meadow = await opprettElev("Meadow", "Soprano");
  await koblePaFag(tony, fag);
  await koblePaFag(meadow, fag);
});

describe("plasserIRom", () => {
  it("nummererer forfra og fra venstre", () => {
    const p = k.plasserIRom([
      { id: "t", type: "tavle", x: 300, y: 20, rot: 0 },
      { id: "b", type: "dobbel", x: 80, y: 240, rot: 0 },
      { id: "a", type: "dobbel", x: 360, y: 160, rot: 0 },
      { id: "c", type: "enkelt", x: 80, y: 160, rot: 0 },
    ]);
    expect(p.map((x) => [x.nr, x.delId])).toEqual([
      [1, "c"],
      [2, "a"],
      [3, "a"],
      [4, "b"],
      [5, "b"],
    ]);
  });

  it("roterer plassene med pulten", () => {
    const [a, b] = k.plasserIRom([
      { id: "d", type: "dobbel", x: 0, y: 100, rot: 90 },
    ]);
    // Stående dobbeltpult: 60 bred, 200 høy, plassene over hverandre.
    expect([a.x, a.y]).toEqual([30, 150]);
    expect([b.x, b.y]).toEqual([30, 250]);
    expect(k.storrelse({ type: "dobbel", rot: 90 })).toEqual({ b: 60, h: 200 });
  });

  it("malene gir de plassene SPEC-en lover", () => {
    const med = (m: Parameters<typeof k.romMal>[0]) =>
      k.plasserIRom(k.romMal(m).map((d, i) => ({ ...d, id: String(i) })))
        .length;
    expect(med("par")).toBe(30);
    expect(med("enkelt")).toBe(30);
    expect(med("grupper4")).toBe(32);
    expect(med("hestesko")).toBeGreaterThan(20);
  });
});

describe("rom", () => {
  it("lagres, endres og slettes uten å ta kartene med", async () => {
    const rom = await k.opprettRom("Rom 214", k.romMal("par"));
    const kart = await k.opprettKart({
      skolearId: ar,
      kildeType: "fag",
      kildeId: fag,
      romId: rom,
    });
    let [r] = await k.hentRom();
    expect(r.navn).toBe("Rom 214");
    expect(r.brukesAv).toBe(1);
    expect(r.deler.every((d) => typeof d.id === "string")).toBe(true);

    await k.endreRom(rom, { navn: "Rom 215" });
    [r] = await k.hentRom();
    expect(r.navn).toBe("Rom 215");

    await k.slettRom(rom);
    expect(await k.hentRom()).toEqual([]);
    const [kk] = await k.hentKart(ar);
    expect(kk.id).toBe(kart);
    expect(kk.romId).toBeNull();
  });
});

describe("kart og elever", () => {
  it("henter fagets elever med navnet på faget", async () => {
    await k.opprettKart({
      skolearId: ar,
      kildeType: "fag",
      kildeId: fag,
      romId: null,
    });
    const [kart] = await k.hentKart(ar);
    expect(kart.kildeNavn).toBe("MFL1");
    expect(kart.antall).toBe(2);
    expect(kart.innstillinger).toEqual(k.STANDARD);
  });

  it("henter klassen og mentorgruppa", async () => {
    const kl = await finnEllerOpprettKlasse(ar, "2STA");
    await settKlasse(tony, ar, kl);
    await settKlasse(meadow, ar, kl);
    await settMentor(tony, ar, true);
    expect((await k.hentKildeElever("klasse", kl, ar)).length).toBe(2);
    const mentor = await k.hentKildeElever("mentorgruppe", ar, ar);
    expect(mentor.map((e) => e.fornavn)).toEqual(["Tony"]);
  });

  it("regner innsats av de ti siste skåringene, uten «ikke i økta»", async () => {
    for (let i = 1; i <= 12; i++) {
      const o = await opprettOkt(
        fag,
        "MFL1",
        `2026-09-${String(i).padStart(2, "0")}`,
        "08:15",
        90,
      );
      // Tony: rødt de to første (eldst) og grønt resten — de to røde faller
      // utenfor de ti siste.
      await settSkaring(tony, o, i <= 2 ? ROD : GRONN);
      // Meadow: bare «ikke i økta», som aldri teller.
      await settSkaring(meadow, o, IV);
    }
    const elever = await k.hentKildeElever("fag", fag, ar);
    const t = elever.find((e) => e.id === tony)!;
    const m = elever.find((e) => e.id === meadow)!;
    expect(t.innsats).toBe(1);
    expect(m.innsats).toBe(0.5);
  });

  it("gir kjønn tilbake når det er satt, ellers null", async () => {
    await base.execute("UPDATE elev SET kjonn = 'j' WHERE id = $1", [meadow]);
    const elever = await k.hentKildeElever("fag", fag, ar);
    expect(elever.find((e) => e.id === meadow)!.kjonn).toBe("j");
    expect(elever.find((e) => e.id === tony)!.kjonn).toBeNull();
  });
});

describe("oppsett og historikk", () => {
  it("lagres og hentes nyeste først, og teller hvem som har sittet sammen", async () => {
    const kart = await k.opprettKart({
      skolearId: ar,
      kildeType: "fag",
      kildeId: fag,
      romId: null,
    });
    await k.lagreOppsett(kart, "plass", [
      { elevId: tony, plass: 1, last: true },
      { elevId: meadow, plass: 2 },
    ]);
    const o = await k.hentOppsett(kart, "plass");
    expect(o).toHaveLength(1);
    expect(o[0].rader).toContainEqual({
      elevId: tony,
      plass: 1,
      gruppe: null,
      gruppenavn: null,
      last: true,
    });
    const { ganger } = k.sammenFor(
      o,
      (a, b) => Math.abs(a.plass! - b.plass!) === 1,
    );
    expect(ganger.get(k.parNokkel(tony, meadow))).toBe(1);
  });

  it("vekter de siste oppsettene tyngst", () => {
    const o = (a: string, b: string) => ({
      id: a + b,
      tid: "",
      rader: [
        { elevId: a, plass: null, gruppe: 1, gruppenavn: null, last: false },
        { elevId: b, plass: null, gruppe: 1, gruppenavn: null, last: false },
      ],
    });
    const { vekt } = k.sammenFor(
      [o("a", "b"), o("c", "d")],
      (x, y) => x.gruppe === y.gruppe,
    );
    expect(vekt.get("a|b")).toBe(1);
    expect(vekt.get("c|d")).toBeCloseTo(0.8);
  });
});

describe("regler", () => {
  it("«hold fra hverandre» lagres én gang, uansett rekkefølge", async () => {
    const a = await k.leggTilRegel("fag", fag, tony, meadow);
    const b = await k.leggTilRegel("fag", fag, meadow, tony);
    expect(b).toBe(a);
    expect(await k.hentRegler("fag", fag)).toHaveLength(1);
    await k.slettRegel(a);
    expect(await k.hentRegler("fag", fag)).toHaveLength(0);
  });

  it("sletting av en elev tar plasseringene og reglene med", async () => {
    const kart = await k.opprettKart({
      skolearId: ar,
      kildeType: "fag",
      kildeId: fag,
      romId: null,
    });
    await k.lagreOppsett(kart, "plass", [{ elevId: tony, plass: 1 }]);
    await k.leggTilRegel("fag", fag, tony, meadow);
    await slettElevHelt(tony);
    const p = await base.select<{ slettet: string | null }[]>(
      "SELECT slettet FROM plassering",
    );
    expect(p.every((r) => r.slettet !== null)).toBe(true);
    const r = await base.select<{ slettet: string | null }[]>(
      "SELECT slettet FROM elevregel",
    );
    expect(r.every((x) => x.slettet !== null)).toBe(true);
  });
});

describe("hentElevIKart", () => {
  it("viser kartet, hvem eleven sitter ved, låsen og reglene", async () => {
    const paulie = await opprettElev("Paulie", "Gualtieri");
    await koblePaFag(paulie, fag);
    const rom = await k.opprettRom("Rom 214", k.romMal("par"));
    const kart = await k.opprettKart({
      skolearId: ar,
      kildeType: "fag",
      kildeId: fag,
      romId: rom,
    });
    await k.lagreOppsett(kart, "plass", [
      { elevId: tony, plass: 1, last: true },
      { elevId: meadow, plass: 2 },
      { elevId: paulie, plass: 7 },
    ]);
    await k.leggTilRegel("fag", fag, tony, paulie);

    const [t] = await k.hentElevIKart(tony, ar);
    expect(t.kildeNavn).toBe("MFL1");
    expect(t.romNavn).toBe("Rom 214");
    expect(t.plass).toBe(1);
    expect(t.last).toBe(true);
    expect(t.rad).toBe(1);
    expect(t.sitterVed.map((e) => e.fornavn)).toEqual(["Meadow"]);
    expect(t.regler.map((r) => r.andre.fornavn)).toEqual(["Paulie"]);
    expect(t.medelever.map((e) => e.fornavn).sort()).toEqual([
      "Meadow",
      "Paulie",
    ]);

    const [p] = await k.hentElevIKart(paulie, ar);
    expect(p.rad).toBe(2);
    expect(p.last).toBe(false);
  });

  it("er tom for en elev som ikke er i noe kart", async () => {
    const ny = await opprettElev("Bobby", "Baccalieri");
    await k.opprettKart({
      skolearId: ar,
      kildeType: "fag",
      kildeId: fag,
      romId: null,
    });
    expect(await k.hentElevIKart(ny, ar)).toEqual([]);
  });
});
