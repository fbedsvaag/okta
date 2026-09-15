import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  finnEllerOpprettKlasse,
  hentElever,
  opprettElev,
  settKlasse,
  settMentor,
} = await import("./elever");
const { opprettSkolear } = await import("./skolear");

let skolearId = "";

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
});

async function elevIKlasse(fornavn: string, klasse: string): Promise<string> {
  const id = await opprettElev(fornavn, "Soprano");
  await settKlasse(id, skolearId, await finnEllerOpprettKlasse(skolearId, klasse));
  return id;
}

describe("mentorgruppa", () => {
  it("er av som standard for en elev i en klasse", async () => {
    await elevIKlasse("Tony", "1STC");
    const [elev] = await hentElever(skolearId);
    expect(elev.mentor).toBe(false);
  });

  it("merker bare de elevene som faktisk er mine", async () => {
    // Poenget med gruppa: seksten av trettito i klassen er dine.
    const tony = await elevIKlasse("Tony", "1STC");
    await elevIKlasse("Carmela", "1STC");

    expect(await settMentor(tony, skolearId, true)).toBe(true);

    const elever = await hentElever(skolearId);
    expect(elever.filter((e) => e.mentor).map((e) => e.fornavn)).toEqual(["Tony"]);
  });

  it("lar merket fjernes igjen", async () => {
    const tony = await elevIKlasse("Tony", "1STC");
    await settMentor(tony, skolearId, true);
    await settMentor(tony, skolearId, false);

    const [elev] = await hentElever(skolearId);
    expect(elev.mentor).toBe(false);
  });

  it("sier fra når eleven ikke har en klasse å henge merket på", async () => {
    // Flagget ligger på klassekoblingen, så uten klasse finnes det ingen rad
    // å merke. Da skal kallet si fra framfor å forsvinne i stillhet.
    const uten = await opprettElev("Jennifer", "Melfi");
    expect(await settMentor(uten, skolearId, true)).toBe(false);
  });

  it("mister merket når klassen fjernes", async () => {
    const tony = await elevIKlasse("Tony", "1STC");
    await settMentor(tony, skolearId, true);
    await settKlasse(tony, skolearId, null);

    const [elev] = await hentElever(skolearId);
    expect(elev.mentor).toBe(false);
  });

  it("gjelder ett skoleår om gangen", async () => {
    // Neste år er det en annen gruppe, og fjorårets skal stå urørt.
    const tony = await elevIKlasse("Tony", "1STC");
    await settMentor(tony, skolearId, true);

    const nesteAr = await opprettSkolear("2027/28", "2027-08-16", "2028-06-19");
    await settKlasse(
      tony,
      nesteAr,
      await finnEllerOpprettKlasse(nesteAr, "2STC"),
    );

    expect((await hentElever(skolearId))[0].mentor).toBe(true);
    expect((await hentElever(nesteAr))[0].mentor).toBe(false);
  });
});

describe("elever uten fag", () => {
  it("vises i oversikten så lenge de har en klasse", async () => {
    // Det vanlige mentortilfellet: du er kontaktlærer for elever du ikke
    // underviser. De har ingen fagkobling, og skal likevel stå i lista.
    await elevIKlasse("Tony", "1STC");
    const elever = await hentElever(skolearId);

    expect(elever).toHaveLength(1);
    expect(elever[0].fagKoder).toEqual([]);
  });
});
