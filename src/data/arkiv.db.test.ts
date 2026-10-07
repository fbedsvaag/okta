import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, koblePaFag, finnEllerOpprettKlasse, settKlasse } =
  await import("./elever");
const { opprettElevnotat, settLukket } = await import("./elevnotat");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettOkt, settSkaring, settSkaringsnotat } = await import("./okter");
const { byggArkiv } = await import("./arkiv");

const GRONN = "5ca1ade1-0001-4000-8000-000000000004";
const skolear = {
  id: "",
  navn: "2026/27",
  start: "2026-08-17",
  slutt: "2027-06-20",
};
let fag = "";

beforeEach(async () => {
  base.nullstill();
  skolear.id = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(skolear.id, "MFL1", "Markedsføring", null);
});

const fil = (filer: { sti: string; innhold: string }[], sti: string) =>
  filer.find((f) => f.sti === `2026-27/${sti}`)?.innhold ?? "";

describe("byggArkiv", () => {
  it("tar med møteloggen, øktnotatene og oppfølgingen", async () => {
    const tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fag);
    const n = await opprettElevnotat(tony, skolear.id, {
      dato: "2026-09-10",
      tekst: "Snakket om fravær",
      skalFolgesOpp: true,
      frist: "2026-10-01",
    });
    await opprettElevnotat(tony, skolear.id, {
      dato: "2026-09-12",
      tekst: "Ringte hjem",
    });
    const skaret = await opprettOkt(fag, "MFL1", "2026-09-01", "08:15", 90);
    await settSkaring(tony, skaret, GRONN);
    await settSkaringsnotat(tony, skaret, "Jobbet godt");
    // Ikke skåret, men notatet skal likevel med.
    const uskaret = await opprettOkt(fag, "MFL1", "2026-09-08", "08:15", 90);
    await settSkaringsnotat(tony, uskaret, "Kom for sent");

    const filer = await byggArkiv(skolear);
    const elev = fil(filer, "elever/tony-soprano.md");
    expect(elev).toContain("## Notater og møtelogg");
    expect(elev).toContain("Snakket om fravær");
    expect(elev).toContain("Ringte hjem");
    expect(elev).toContain("Kom for sent");
    expect(elev).toContain("| Jobbet godt |");
    expect(elev).toContain("følges opp, frist 2026-10-01");

    await settLukket(n, true);
    const oppfolging = fil(await byggArkiv(skolear), "oppfolging.md");
    expect(oppfolging).toContain("Snakket om fravær");
    expect(oppfolging).toContain("fulgt opp");
    expect(oppfolging).not.toContain("Ringte hjem");
  });

  it("tar med mentorelever som ikke står i noe fag", async () => {
    const aj = await opprettElev("AJ", "Soprano");
    const k = await finnEllerOpprettKlasse(skolear.id, "2STA");
    await settKlasse(aj, skolear.id, k);
    const filer = await byggArkiv(skolear);
    expect(fil(filer, "elever/aj-soprano.md")).toContain("# AJ Soprano");
  });
});

describe("byggArkiv og egne gjøremål", () => {
  it("står i oppfolging.md, åpne og ferdige", async () => {
    const { nyttGjoremal, hentGjoremal, fullforGjoremal } =
      await import("./gjoremal");
    await nyttGjoremal(skolear.id, {
      tekst: "Kopier prøvene",
      frist: "2026-10-02",
    });
    await nyttGjoremal(skolear.id, { tekst: "Bestill rom" });
    const [forste] = await hentGjoremal(skolear.id);
    await fullforGjoremal(forste);
    const ut = fil(await byggArkiv(skolear), "oppfolging.md");
    expect(ut).toContain("- [x] Kopier prøvene, frist 2026-10-02, ferdig");
    expect(ut).toContain("- [ ] Bestill rom");
  });
});
