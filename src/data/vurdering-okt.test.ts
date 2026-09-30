import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr, endreFagIAr } = await import("./fag");
const { opprettOkt, endreOkt, hentOktVurderinger, hentOkter } =
  await import("./okter");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering, settFrist, knyttOkt, losOkt, hentVurderinger } =
  await import("./vurderinger");

/** Karakter 1–6, seedet i migrasjon 002. */
async function skala(): Promise<string> {
  const [s] = await base.select<{ id: string }[]>(
    "SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1",
  );
  return s.id;
}

let skolearId = "";
let fagId = "";

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
});

async function vurdering(id: string) {
  return (await hentVurderinger(skolearId)).find((v) => v.id === id)!;
}

describe("vurdering knyttet til økt", () => {
  it("knyttes til økta når fristen faller på en øktdag", async () => {
    const okt = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Prøve",
      null,
      "2026-10-06",
    );
    expect((await vurdering(v)).oktIder).toEqual([okt]);
    expect((await hentOktVurderinger(skolearId)).get(okt)?.[0].tittel).toBe(
      "Prøve",
    );
  });

  it("gjetter ikke når faget har to økter samme dag", async () => {
    await opprettOkt(fagId, "MFL1", "2026-10-06", "08:30", 90);
    await opprettOkt(fagId, "MFL1", "2026-10-06", "12:30", 90);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Prøve",
      null,
      "2026-10-06",
    );
    expect((await vurdering(v)).oktIder).toEqual([]);
  });

  it("kobles når økta legges inn etter vurderingen", async () => {
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Prøve",
      null,
      "2026-10-06",
    );
    const okt = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    expect((await vurdering(v)).oktIder).toEqual([okt]);
  });

  it("følger fristen når koblingen kom fra fristen", async () => {
    await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    const ny = await opprettOkt(fagId, "MFL1", "2026-10-13", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Prøve",
      null,
      "2026-10-06",
    );
    await settFrist(v, "2026-10-13");
    expect((await vurdering(v)).oktIder).toEqual([ny]);
  });

  it("beholder en kobling du har satt selv, når fristen flyttes", async () => {
    // Innlevering: gis ut i timen 6. oktober, leveres en uke senere.
    const utdeling = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Innlevering",
      null,
      null,
    );
    await knyttOkt(v, utdeling);
    await settFrist(v, "2026-10-20");
    const etter = await vurdering(v);
    expect(etter.oktIder).toEqual([utdeling]);
    expect(etter.frist).toBe("2026-10-20");
  });

  it("bruker øktas dato som frist når fristen mangler", async () => {
    const okt = await opprettOkt(fagId, "MFL1", "2026-11-03", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Muntlig",
      null,
      null,
    );
    await knyttOkt(v, okt);
    expect((await vurdering(v)).frist).toBe("2026-11-03");
  });

  it("vises ikke på økta når den er løst fra den, selv på samme dato", async () => {
    const okt = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Prøve",
      null,
      "2026-10-06",
    );
    await losOkt(v, okt);
    expect((await hentOktVurderinger(skolearId)).has(okt)).toBe(false);
  });

  it("følger økta når den flyttes til en annen dato", async () => {
    const okt = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    await opprettVurdering(fagId, await skala(), "Prøve", null, "2026-10-06");
    await endreOkt(okt, { dato: "2026-10-08" });
    expect((await hentOktVurderinger(skolearId)).get(okt)).toHaveLength(1);
  });
});

describe("vurdering over flere økter", () => {
  it("står på alle øktene den er knyttet til", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-11-03", null, 180);
    const b = await opprettOkt(fagId, "MFL1", "2026-11-05", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Muntlig",
      null,
      "2026-11-03",
    );
    await knyttOkt(v, b);
    expect((await vurdering(v)).oktIder.sort()).toEqual([a, b].sort());
    const kart = await hentOktVurderinger(skolearId);
    expect(kart.get(a)?.[0].tittel).toBe("Muntlig");
    expect(kart.get(b)?.[0].tittel).toBe("Muntlig");
  });

  it("lar den andre økta stå når én løses", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-11-03", null, 180);
    const b = await opprettOkt(fagId, "MFL1", "2026-11-05", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Muntlig",
      null,
      "2026-11-03",
    );
    await knyttOkt(v, b);
    await losOkt(v, a);
    expect((await vurdering(v)).oktIder).toEqual([b]);
  });

  it("flytter ikke øktene når fristen flyttes", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-11-03", null, 180);
    const b = await opprettOkt(fagId, "MFL1", "2026-11-05", null, 180);
    await opprettOkt(fagId, "MFL1", "2026-11-10", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Muntlig",
      null,
      "2026-11-03",
    );
    await knyttOkt(v, b);
    await settFrist(v, "2026-11-10");
    expect((await vurdering(v)).oktIder.sort()).toEqual([a, b].sort());
  });

  it("gjenbruker koblingsraden når en løst økt knyttes igjen", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-11-03", null, 180);
    const v = await opprettVurdering(
      fagId,
      await skala(),
      "Muntlig",
      null,
      "2026-11-03",
    );
    await losOkt(v, a);
    await knyttOkt(v, a); // ville feilet på UNIQUE uten gjenbruk
    const rader = await base.select<unknown[]>(
      "SELECT id FROM vurdering_okt WHERE vurdering_id = $1",
      [v],
    );
    expect(rader).toHaveLength(1);
    expect((await vurdering(v)).oktIder).toEqual([a]);
  });
});

describe("standard rom", () => {
  it("fyller ut stedet på nye økter i faget", async () => {
    await endreFagIAr(fagId, { rom: "R204" });
    const okt = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    expect((await hentOkter(skolearId)).find((o) => o.id === okt)?.sted).toBe(
      "R204",
    );
  });
});
