import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  hentHistorikk,
  hentSamtaledager,
  hentSamtaler,
  lagreTrekning,
  opprettSamtaledag,
  settMotte,
  slettSamtaledag,
} = await import("./samtale");
const { opprettElev } = await import("./elever");
const { opprettSkolear } = await import("./skolear");
const { leggFagIAr } = await import("./fag");

let skolearId = "";
let fagId = "";
let elever: string[] = [];

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
  elever = [];
  for (const navn of ["Tony", "Carmela", "Adriana", "Silvio", "Paulie", "Furio"]) {
    elever.push(await opprettElev(navn, "Soprano"));
  }
});

async function dagMed(dato: string, fag: string | null = fagId): Promise<string> {
  return opprettSamtaledag(skolearId, {
    skolearFagId: fag,
    dato,
    fra: "08:30",
    til: "15:00",
    lunsjFra: "11:45",
    lunsjMin: 30,
  });
}

/** Legger elevene ut i rekkefølge fra 09:00, 20 minutter hver. */
async function trekning(dagId: string, ider: string[]) {
  await lagreTrekning(
    dagId,
    ider.map((elevId, i) => ({
      elevId,
      klokkeslett: `${String(9 + Math.floor(i / 3)).padStart(2, "0")}:${String((i % 3) * 20).padStart(2, "0")}`,
      varighetMin: 20,
      tema: null,
    })),
  );
}

describe("samtaledager", () => {
  it("lar en dag stå uten fag — mentorsamtalen har ikke noe", async () => {
    await dagMed("2026-11-24", null);
    const [dag] = await hentSamtaledager(skolearId);
    expect(dag.skolearFagId).toBeNull();
    expect(dag.fagKode).toBeNull();
  });

  it("henter fagkoden når dagen hører til et fag", async () => {
    await dagMed("2026-11-24");
    const [dag] = await hentSamtaledager(skolearId);
    expect(dag.fagKode).toBe("MFL1");
  });

  it("sletter samtalene sammen med dagen", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));

    await slettSamtaledag(dagId);

    expect(await hentSamtaledager(skolearId)).toHaveLength(0);
    expect(await hentSamtaler(dagId)).toHaveLength(0);
  });
});

describe("lagreTrekning", () => {
  it("skriver samtalene i klokkeslettrekkefølge", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));

    const samtaler = await hentSamtaler(dagId);
    expect(samtaler.map((s) => s.klokkeslett)).toEqual(["09:00", "09:20", "09:40"]);
    expect(samtaler.every((s) => s.motte)).toBe(true);
  });

  it("erstatter forrige trekning", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));
    await trekning(dagId, elever.slice(3, 6));

    const samtaler = await hentSamtaler(dagId);
    expect(samtaler).toHaveLength(3);
    expect(samtaler.map((s) => s.fornavn).sort()).toEqual([
      "Furio",
      "Paulie",
      "Silvio",
    ]);
  });

  it("lar en som ikke møtte bli stående gjennom en ny trekning", async () => {
    // Samtalen som ikke ble noe av er en opplysning om hva som skjedde, ikke
    // en del av planen som trekkes om (§4.10).
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));

    const [forste] = await hentSamtaler(dagId);
    await settMotte(forste.id, false);

    await trekning(dagId, elever.slice(3, 6));

    const samtaler = await hentSamtaler(dagId);
    expect(samtaler).toHaveLength(4);
    expect(samtaler.filter((s) => !s.motte)).toHaveLength(1);
  });
});

describe("når en elev ikke møter", () => {
  it("lar de andre stå på sine klokkeslett", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));

    const for_ = await hentSamtaler(dagId);
    await settMotte(for_[1].id, false);

    const etter = await hentSamtaler(dagId);
    expect(etter.map((s) => s.klokkeslett)).toEqual(for_.map((s) => s.klokkeslett));
    expect(etter[1].motte).toBe(false);
  });

  it("lar eleven settes opp igjen samme dag", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));

    const [forste] = await hentSamtaler(dagId);
    await settMotte(forste.id, false);

    await lagreTrekning(dagId, [
      { elevId: forste.elevId, klokkeslett: "14:30", varighetMin: 20, tema: null },
    ]);

    const samtaler = await hentSamtaler(dagId);
    const hans = samtaler.filter((s) => s.elevId === forste.elevId);
    expect(hans).toHaveLength(2);
    expect(hans.map((s) => s.motte).sort()).toEqual([false, true]);
  });
});

describe("hentHistorikk", () => {
  it("regner plassering innen dagen", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever); // seks elever

    const h = await hentHistorikk(skolearId);
    expect(h.get(elever[0])).toEqual(["tidlig"]);
    expect(h.get(elever[2])).toEqual(["midt"]);
    expect(h.get(elever[5])).toEqual(["sent"]);
  });

  it("holder dagene fra hverandre, nyeste først", async () => {
    const eldre = await dagMed("2026-09-01");
    await trekning(eldre, elever); // Tony tidlig

    const nyere = await dagMed("2026-11-24");
    await trekning(nyere, [...elever].reverse()); // Tony sent

    const h = await hentHistorikk(skolearId);
    expect(h.get(elever[0])).toEqual(["sent", "tidlig"]);
  });

  it("teller ikke en samtale eleven ikke møtte til", async () => {
    // Hen var ikke der, og plasseringen sier da ingenting om når hen faktisk
    // måtte møte — samme prinsipp som teller_ikke i §5.1.
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever);

    const samtaler = await hentSamtaler(dagId);
    await settMotte(samtaler[0].id, false);

    const h = await hentHistorikk(skolearId);
    expect(h.get(elever[0])).toBeUndefined();
  });

  it("markerer ikke en dag med under tre elever", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 2));

    expect((await hentHistorikk(skolearId)).size).toBe(0);
  });

  it("er tom når ingenting er trukket", async () => {
    expect((await hentHistorikk(skolearId)).size).toBe(0);
  });
});
