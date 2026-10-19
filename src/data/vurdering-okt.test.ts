import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { leggFagIAr, endreFagIAr } = await import("./fag");
const {
  opprettOkt,
  endreOkt,
  hentOktVurderinger,
  hentOkter,
  slettOkter,
  gjenopprettOkter,
  byttOkter,
  settSkaring,
} = await import("./okter");
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
  it("gjelder også øktene som finnes, men ikke et rom satt for hånd", async () => {
    const uten = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    const egen = await opprettOkt(fagId, "MFL1", "2026-10-07", null, 180);
    await endreOkt(egen, { sted: "Gymsal" });
    await endreFagIAr(fagId, { rom: "R204" });
    const sted = async (id: string) =>
      (await hentOkter(skolearId)).find((o) => o.id === id)?.sted;
    expect(await sted(uten)).toBe("R204");
    expect(await sted(egen)).toBe("Gymsal");

    // Byttes standardrommet, følger de som hadde det gamle med.
    await endreFagIAr(fagId, { rom: "R310" });
    expect(await sted(uten)).toBe("R310");
    expect(await sted(egen)).toBe("Gymsal");
  });

  it("fyller ut stedet på nye økter i faget", async () => {
    await endreFagIAr(fagId, { rom: "R204" });
    const okt = await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180);
    expect((await hentOkter(skolearId)).find((o) => o.id === okt)?.sted).toBe(
      "R204",
    );
  });
});

describe("avholdte økter", () => {
  it("regnes etter dato, ikke etter om noen er skåret", async () => {
    const { hentTimeregnskap } = await import("./dashbord");
    const { hentNokkeltall } = await import("./fagportal");
    await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180); // forbi, uskåret
    await opprettOkt(fagId, "MFL1", "2026-09-30", null, 180); // i dag
    await opprettOkt(fagId, "MFL1", "2026-10-06", null, 180); // kommer
    const idag = "2026-09-30";
    const [fag] = await hentTimeregnskap(skolearId, idag);
    expect(fag.avholdte).toBe(2);
    expect((await hentNokkeltall(fagId, idag)).avholdte).toBe(2);
  });

  it("regner holdte minutter fram til nå, også midt i en økt", async () => {
    const { hentTimeregnskap, holdtNa } = await import("./dashbord");
    await opprettOkt(fagId, "MFL1", "2026-09-01", "08:30", 90); // forbi
    await opprettOkt(fagId, "MFL1", "2026-09-30", "08:30", 90); // i dag
    await opprettOkt(fagId, "MFL1", "2026-09-30", null, 60); // i dag, uten tid
    await opprettOkt(fagId, "MFL1", "2026-10-06", "08:30", 90); // kommer
    const [fag] = await hentTimeregnskap(skolearId, "2026-09-30");
    expect(fag.holdtForMin).toBe(90);
    expect(fag.idag).toHaveLength(2);
    // Før økta i dag, midt i den, og etter den.
    expect(holdtNa(fag, 8 * 60)).toBe(90);
    expect(holdtNa(fag, 9 * 60)).toBe(120);
    expect(holdtNa(fag, 12 * 60)).toBe(180);
  });
});

describe("alias", () => {
  it("vises i stedet for koden, men den offisielle koden er der fortsatt", async () => {
    const { endreFag, hentFagIAr } = await import("./fag");
    const { hentOkter } = await import("./okter");
    const [f] = await hentFagIAr(skolearId);
    await endreFag(f.fagId, { alias: "MFLX" });
    await opprettOkt(fagId, f.fagkode, "2026-10-06", null, 180);

    const [etter] = await hentFagIAr(skolearId);
    expect(etter.kode).toBe("MFLX");
    expect(etter.fagkode).toBe("MFL1");
    const [okt] = await hentOkter(skolearId);
    expect(okt.fagKode).toBe("MFLX");
    // Øktkoden bruker den offisielle koden, så den er stabil.
    expect(okt.kode).toContain("MFL1");
  });

  it("faller tilbake på koden når aliaset er tomt", async () => {
    const { endreFag, hentFagIAr } = await import("./fag");
    const [f] = await hentFagIAr(skolearId);
    await endreFag(f.fagId, { alias: "" });
    expect((await hentFagIAr(skolearId))[0].kode).toBe("MFL1");
  });
});

describe("slette og angre", () => {
  it("tar slettede økter tilbake med alt de hadde", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-10-06", "08:30", 90);
    const b = await opprettOkt(fagId, "MFL1", "2026-10-08", "08:30", 90);
    await endreOkt(a, {
      tema: "Markedsmiks",
      plan: "- [ ] Gjennomgang · 30 min",
    });
    await slettOkter([a, b]);
    expect(await hentOkter(skolearId)).toHaveLength(0);
    await gjenopprettOkter([a, b]);
    const okter = await hentOkter(skolearId);
    expect(okter).toHaveLength(2);
    expect(okter.find((o) => o.id === a)?.tema).toBe("Markedsmiks");
    expect(okter.find((o) => o.id === a)?.plan).toContain("Gjennomgang");
  });
});

describe("bytte to økter", () => {
  it("bytter innholdet, men dato, tid og rom står", async () => {
    const { settOktmal, hentOktmal } = await import("./perioder");
    const a = await opprettOkt(fagId, "MFL1", "2026-10-06", "08:30", 90);
    const b = await opprettOkt(fagId, "MFL1", "2026-10-08", "10:15", 90);
    await endreOkt(a, { tema: "Markedsmiks", lekse: "Les kap. 3", sted: "R1" });
    await endreOkt(b, { tema: "Prising", agenda: "Case", sted: "R2" });
    await settOktmal(a, "KM1", true);
    const v = await opprettVurdering(fagId, await skala(), "Prøve", null, null);
    await knyttOkt(v, b);

    expect(await byttOkter(a, b)).toBe(true);
    const okter = await hentOkter(skolearId);
    const A = okter.find((o) => o.id === a)!;
    const B = okter.find((o) => o.id === b)!;
    expect([A.dato, A.klokkeslett, A.sted]).toEqual([
      "2026-10-06",
      "08:30",
      "R1",
    ]);
    expect([A.tema, A.agenda, A.lekse]).toEqual(["Prising", "Case", null]);
    expect([B.tema, B.lekse]).toEqual(["Markedsmiks", "Les kap. 3"]);
    expect((await hentOktmal(b)).egne).toEqual(["KM1"]);
    expect((await hentOktmal(a)).egne).toEqual([]);
    const vo = await hentOktVurderinger(skolearId);
    expect(vo.get(a)?.map((x) => x.id)).toEqual([v]);
    expect(vo.get(b) ?? []).toEqual([]);

    // Et nytt bytte angrer det første.
    await byttOkter(a, b);
    const igjen = await hentOkter(skolearId);
    expect(igjen.find((o) => o.id === a)?.tema).toBe("Markedsmiks");
    expect((await hentOktmal(a)).egne).toEqual(["KM1"]);
  });

  it("lar skårede økter ligge fast", async () => {
    const a = await opprettOkt(fagId, "MFL1", "2026-10-06", "08:30", 90);
    const b = await opprettOkt(fagId, "MFL1", "2026-10-08", "08:30", 90);
    await endreOkt(a, { tema: "Skåret" });
    const { opprettElev, koblePaFag } = await import("./elever");
    const elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fagId);
    const [verdi] = await base.select<{ id: string }[]>(
      "SELECT id FROM skalaverdi LIMIT 1",
    );
    await settSkaring(elev, a, verdi.id);
    expect(await byttOkter(a, b)).toBe(false);
    expect((await hentOkter(skolearId)).find((o) => o.id === a)?.tema).toBe(
      "Skåret",
    );
  });
});
