import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";
import type { Elevnotat } from "./elevnotat";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  erForfalt,
  hentElevnotater,
  hentForfalte,
  opprettElevnotat,
  settLukket,
  sorterNotater,
} = await import("./elevnotat");
const { opprettElev } = await import("./elever");
const { opprettSkolear } = await import("./skolear");

// ------------------------------------------------------- rene funksjoner

function notat(over: Partial<Elevnotat>): Elevnotat {
  return {
    id: Math.random().toString(36).slice(2),
    elevId: "e",
    skolearId: "a",
    skolearFagId: null,
    fagKode: null,
    dato: "2026-09-01",
    tekst: "…",
    skalFolgesOpp: false,
    frist: null,
    lukket: null,
    ...over,
  };
}

describe("sorterNotater", () => {
  it("løfter åpne oppfølgingspunkter øverst, uansett dato", () => {
    const gammelt = notat({ dato: "2026-08-01", skalFolgesOpp: true });
    const nytt = notat({ dato: "2026-12-01" });

    expect(sorterNotater([nytt, gammelt])[0]).toBe(gammelt);
  });

  it("lar et lukket punkt synke ned i kronologien igjen", () => {
    const lukket = notat({
      dato: "2026-08-01",
      skalFolgesOpp: true,
      lukket: "2026-09-15",
    });
    const nytt = notat({ dato: "2026-12-01" });

    expect(sorterNotater([lukket, nytt])[0]).toBe(nytt);
  });

  it("setter tidligste frist først blant de åpne", () => {
    const sent = notat({ skalFolgesOpp: true, frist: "2026-12-01" });
    const tidlig = notat({ skalFolgesOpp: true, frist: "2026-10-01" });

    expect(sorterNotater([sent, tidlig])[0]).toBe(tidlig);
  });

  it("lar punkter uten frist stå etter dem med frist, men fortsatt øverst", () => {
    // «Skal følges opp» uten frist er lov: mye oppfølging har ingen dato, den
    // er bare der til den er gjort.
    const utenFrist = notat({ skalFolgesOpp: true, frist: null });
    const medFrist = notat({ skalFolgesOpp: true, frist: "2026-10-01" });
    const vanlig = notat({ dato: "2027-01-01" });

    const sortert = sorterNotater([vanlig, utenFrist, medFrist]);
    expect(sortert.map((n) => n.id)).toEqual([
      medFrist.id,
      utenFrist.id,
      vanlig.id,
    ]);
  });

  it("sorterer vanlige notater nyeste først", () => {
    const eldst = notat({ dato: "2026-08-01" });
    const nyest = notat({ dato: "2026-12-01" });

    expect(sorterNotater([eldst, nyest])[0]).toBe(nyest);
  });
});

describe("erForfalt", () => {
  it("er forfalt når fristen er passert og punktet er åpent", () => {
    const n = notat({ skalFolgesOpp: true, frist: "2026-09-01" });
    expect(erForfalt(n, "2026-09-02")).toBe(true);
  });

  it("er ikke forfalt uten frist", () => {
    // Uten frist finnes det ingenting å sammenlikne mot (§4.7).
    const n = notat({ skalFolgesOpp: true, frist: null });
    expect(erForfalt(n, "2030-01-01")).toBe(false);
  });

  it("er ikke forfalt når punktet er lukket", () => {
    const n = notat({
      skalFolgesOpp: true,
      frist: "2026-09-01",
      lukket: "2026-09-01",
    });
    expect(erForfalt(n, "2026-12-01")).toBe(false);
  });

  it("er ikke forfalt på selve fristdagen", () => {
    const n = notat({ skalFolgesOpp: true, frist: "2026-09-01" });
    expect(erForfalt(n, "2026-09-01")).toBe(false);
  });
});

// ------------------------------------------------------------ mot basen

describe("møteloggen i basen", () => {
  let elevId = "";
  let skolearId = "";

  beforeEach(async () => {
    base.nullstill();
    skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    elevId = await opprettElev("Tony", "Soprano");
  });

  it("lagrer et notat uten fag — mentorsamtalen har ikke noe", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-15",
      tekst: "Kontaktmøte. Går bedre i matte.",
    });

    const [n] = await hentElevnotater(elevId);
    expect(n.skolearFagId).toBeNull();
    expect(n.tekst).toBe("Kontaktmøte. Går bedre i matte.");
    expect(n.skalFolgesOpp).toBe(false);
  });

  it("holder flere møter fra hverandre, nyeste først", async () => {
    await opprettElevnotat(elevId, skolearId, { dato: "2026-09-01", tekst: "Første" });
    await opprettElevnotat(elevId, skolearId, { dato: "2026-11-01", tekst: "Andre" });

    const notater = await hentElevnotater(elevId);
    expect(notater.map((n) => n.tekst)).toEqual(["Andre", "Første"]);
  });

  it("lar et punkt lukkes og åpnes igjen", async () => {
    const id = await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-15",
      tekst: "Følg opp fravær",
      skalFolgesOpp: true,
    });

    await settLukket(id, true);
    expect((await hentElevnotater(elevId))[0].lukket).not.toBeNull();

    await settLukket(id, false);
    expect((await hentElevnotater(elevId))[0].lukket).toBeNull();
  });

  it("finner elever med forfalt frist, men ikke dem uten frist", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-01",
      tekst: "Uten frist",
      skalFolgesOpp: true,
    });
    expect(await hentForfalte(skolearId)).toEqual(new Set());

    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-01",
      tekst: "Med passert frist",
      skalFolgesOpp: true,
      frist: "2020-01-01",
    });
    expect(await hentForfalte(skolearId)).toEqual(new Set([elevId]));
  });
});
