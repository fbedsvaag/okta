import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, slettElevHelt } = await import("./elever");
const { opprettElevnotat, hentElevnotater } = await import("./elevnotat");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, endreOkt, hentOkter } = await import("./okter");
const { hentGjoremal, fullforGjoremal, apneBokser, forsteLinje } =
  await import("./gjoremal");

let ar = "";
let fag = "";
let tony = "";

beforeEach(async () => {
  base.nullstill();
  ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
  tony = await opprettElev("Tony", "Soprano");
});

describe("apneBokser og forsteLinje", () => {
  it("finner bare boksene som ikke er krysset av", () => {
    expect(
      apneBokser("Notat\n- [ ] ring hjem\n- [x] sendt\n  - [ ] følg opp"),
    ).toEqual([
      { linje: 1, tekst: "ring hjem" },
      { linje: 3, tekst: "følg opp" },
    ]);
  });

  it("gir første linje uten markdown", () => {
    expect(forsteLinje("\n# Samtale\nmer")).toBe("Samtale");
  });
});

describe("hentGjoremal", () => {
  it("samler oppfølgingspunkter og åpne bokser fra notater og øktlogger", async () => {
    await opprettElevnotat(tony, ar, {
      dato: "2026-09-10",
      tekst: "Snakket om fravær",
      skalFolgesOpp: true,
      frist: "2026-10-01",
    });
    await opprettElevnotat(tony, ar, {
      dato: "2026-09-20",
      tekst: "- [ ] send melding hjem\n- [x] ferdig",
    });
    await opprettElevnotat(tony, ar, {
      dato: "2026-09-21",
      tekst: "Bare tekst",
    });
    const o = await opprettOkt(fag, "MFL1", "2026-09-15", "08:15", 90);
    await endreOkt(o, { logg: "- [ ] del ut oppgavearket" });

    const g = await hentGjoremal(ar);
    expect(g.map((x) => [x.slag, x.tekst])).toEqual([
      ["oppfolging", "Snakket om fravær"],
      ["elevboks", "send melding hjem"],
      ["oktboks", "del ut oppgavearket"],
    ]);
  });

  it("krysser av der gjøremålet bor", async () => {
    await opprettElevnotat(tony, ar, {
      dato: "2026-09-10",
      tekst: "Fravær",
      skalFolgesOpp: true,
    });
    await opprettElevnotat(tony, ar, {
      dato: "2026-09-20",
      tekst: "- [ ] send melding",
    });
    const o = await opprettOkt(fag, "MFL1", "2026-09-15", "08:15", 90);
    await endreOkt(o, { logg: "Husk:\n- [ ] arket" });

    for (const g of await hentGjoremal(ar)) await fullforGjoremal(g);

    expect(await hentGjoremal(ar)).toEqual([]);
    const notater = await hentElevnotater(tony);
    expect(notater.find((n) => n.tekst === "Fravær")?.lukket).not.toBeNull();
    expect(notater.some((n) => n.tekst === "- [x] send melding")).toBe(true);
    expect((await hentOkter(ar))[0].logg).toBe("Husk:\n- [x] arket");
  });

  it("tar ikke med notater fra slettede elever", async () => {
    await opprettElevnotat(tony, ar, {
      dato: "2026-09-10",
      tekst: "x",
      skalFolgesOpp: true,
    });
    await slettElevHelt(tony);
    expect(await hentGjoremal(ar)).toEqual([]);
  });
});

describe("nyttGjoremal", () => {
  it("med elev blir det et oppfølgingsnotat på eleven", async () => {
    const { nyttGjoremal } = await import("./gjoremal");
    await nyttGjoremal(ar, {
      tekst: "Ring foresatte",
      elevId: tony,
      frist: "2026-10-05",
    });
    const [n] = await hentElevnotater(tony);
    expect(n).toMatchObject({
      tekst: "Ring foresatte",
      skalFolgesOpp: true,
      frist: "2026-10-05",
    });
    expect((await hentGjoremal(ar))[0]).toMatchObject({
      slag: "oppfolging",
      navn: "Tony Soprano",
    });
  });

  it("uten elev blir det et eget gjøremål som kan krysses av", async () => {
    const { nyttGjoremal } = await import("./gjoremal");
    await nyttGjoremal(ar, { tekst: "Kopier prøvene", frist: null });
    await nyttGjoremal(ar, { tekst: "   " });
    const g = await hentGjoremal(ar);
    expect(g.map((x) => [x.slag, x.tekst])).toEqual([
      ["eget", "Kopier prøvene"],
    ]);
    await fullforGjoremal(g[0]);
    expect(await hentGjoremal(ar)).toEqual([]);
  });
});

describe("loggen under Gjøremål", () => {
  it("viser det som er gjort de siste 14 dagene, nyeste først, og kan angres", async () => {
    const { nyttGjoremal, hentLogg, angreLoggpost } =
      await import("./gjoremal");
    const { oppdater } = await import("../db");
    await nyttGjoremal(ar, { tekst: "Ring foresatte", elevId: tony });
    await nyttGjoremal(ar, { tekst: "Kopier prøvene" });
    await nyttGjoremal(ar, { tekst: "Gammelt", elevId: tony });
    for (const g of await hentGjoremal(ar)) await fullforGjoremal(g);

    // Det gamle ble lukket for tre uker siden — det står i arkivet, ikke her.
    const gammelt = (await hentElevnotater(tony)).find(
      (n) => n.tekst === "Gammelt",
    )!;
    const tidlig = new Date();
    tidlig.setDate(tidlig.getDate() - 21);
    await oppdater("elevnotat", gammelt.id, {
      lukket: tidlig.toLocaleDateString("sv-SE"),
    });

    const logg = await hentLogg(ar);
    expect(logg.map((p) => p.tekst).sort()).toEqual([
      "Kopier prøvene",
      "Ring foresatte",
    ]);
    const ring = logg.find((p) => p.tekst === "Ring foresatte")!;
    expect(ring).toMatchObject({ slag: "oppfolging", navn: "Tony Soprano" });
    expect(ring.klokke).toMatch(/^\d\d:\d\d$/);

    // Angre: oppfølgingen er åpen igjen og står blant gjøremålene.
    await angreLoggpost(ring);
    expect((await hentLogg(ar)).map((p) => p.tekst)).toEqual([
      "Kopier prøvene",
    ]);
    expect((await hentGjoremal(ar)).map((g) => g.tekst)).toContain(
      "Ring foresatte",
    );
  });
});
