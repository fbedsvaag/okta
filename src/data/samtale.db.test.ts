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
const { opprettElev, koblePaFag } = await import("./elever");
const { opprettVurdering, hentVurderingElever } = await import("./vurderinger");
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

describe("mentorsamtalen har ingen oppgave", () => {
  it("lagrer tema som null når dagen ikke har fag", async () => {
    // Bug: temalista lastes bare i fagmodus, så den ble stående med forrige
    // fags verdier ved modusbytte — og trekningen delte dem ut likevel.
    const dagId = await opprettSamtaledag(skolearId, {
      skolearFagId: null,
      dato: "2026-11-24",
      fra: "08:30",
      til: "15:00",
      lunsjFra: null,
      lunsjMin: null,
    });

    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "09:00", varighetMin: 20, tema: null },
    ]);

    const [s] = await hentSamtaler(dagId);
    expect(s.tema).toBeNull();
  });

  it("lar fagsamtalen beholde sin oppgave", async () => {
    const dagId = await dagMed("2026-11-24");
    await lagreTrekning(dagId, [
      {
        elevId: elever[0],
        klokkeslett: "09:00",
        varighetMin: 20,
        tema: "Oppgave 4",
      },
    ]);

    const [s] = await hentSamtaler(dagId);
    expect(s.tema).toBe("Oppgave 4");
  });
});

describe("id-er holder seg gjennom en omtrekning", () => {
  it("lar eleven beholde sin samtale-id når hen bare bytter klokkeslett", async () => {
    // Kalenderhendelsen bruker samtale.id som UID (§8.1). Byttes id-en, blir
    // hendelsen slettet og lagt inn på nytt i stedet for å oppdateres — og
    // da forsvinner og dukker den opp igjen hos alle som abonnerer.
    const dagId = await dagMed("2026-11-24");
    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "09:00", varighetMin: 20, tema: null },
    ]);
    const forst = (await hentSamtaler(dagId))[0];

    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "11:00", varighetMin: 20, tema: null },
    ]);
    const etter = (await hentSamtaler(dagId))[0];

    expect(etter.id).toBe(forst.id);
    expect(etter.klokkeslett).toBe("11:00");
  });

  it("lager ikke en dublett av eleven", async () => {
    const dagId = await dagMed("2026-11-24");
    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "09:00", varighetMin: 20, tema: null },
    ]);
    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "11:00", varighetMin: 20, tema: null },
    ]);

    expect(await hentSamtaler(dagId)).toHaveLength(1);
  });

  it("lar den som faller ut av trekningen gå", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));
    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "09:00", varighetMin: 20, tema: null },
    ]);

    const igjen = await hentSamtaler(dagId);
    expect(igjen).toHaveLength(1);
    expect(igjen[0].elevId).toBe(elever[0]);
  });

  it("rører ikke den som ikke møtte", async () => {
    const dagId = await dagMed("2026-11-24");
    await trekning(dagId, elever.slice(0, 3));
    const [forste] = await hentSamtaler(dagId);
    await settMotte(forste.id, false);

    await lagreTrekning(dagId, [
      { elevId: elever[3], klokkeslett: "09:00", varighetMin: 20, tema: null },
    ]);

    const samtaler = await hentSamtaler(dagId);
    expect(samtaler.find((s) => s.id === forste.id)?.motte).toBe(false);
  });
});

describe("oppgaven vises under vurderingen", () => {
  it("finner oppgaven eleven trakk, gjennom vurderingskoblingen", async () => {
    const vurderingId = await opprettVurdering(
      fagId,
      "5ca1a000-0000-4000-8000-000000000004",
      "Muntlig framføring",
      "muntlig",
      null,
    );
    await koblePaFag(elever[0], fagId);

    const dagId = await opprettSamtaledag(skolearId, {
      skolearFagId: fagId,
      vurderingId,
      dato: "2026-11-24",
      fra: "08:30",
      til: "15:00",
      lunsjFra: null,
      lunsjMin: null,
    });
    await lagreTrekning(dagId, [
      {
        elevId: elever[0],
        klokkeslett: "09:00",
        varighetMin: 20,
        tema: "Oppgave 4 · Markedsanalyse",
      },
    ]);

    const [elev] = await hentVurderingElever(vurderingId, fagId);
    expect(elev.oppgave).toBe("Oppgave 4 · Markedsanalyse");
    expect(elev.samtaletid).toBe("2026-11-24 09:00");
  });

  it("gir null når vurderingen ikke har noen trekning", async () => {
    const vurderingId = await opprettVurdering(
      fagId,
      "5ca1a000-0000-4000-8000-000000000004",
      "Skriftlig prøve",
      "skriftlig",
      null,
    );
    await koblePaFag(elever[0], fagId);

    const [elev] = await hentVurderingElever(vurderingId, fagId);
    expect(elev.oppgave).toBeNull();
  });

  it("gir eleven én linje selv om hen ble satt opp to ganger", async () => {
    // Den som ikke møtte og ble satt opp på nytt har to samtalerader. En
    // join ville gitt to linjer i vurderingslista.
    const vurderingId = await opprettVurdering(
      fagId,
      "5ca1a000-0000-4000-8000-000000000004",
      "Muntlig",
      "muntlig",
      null,
    );
    await koblePaFag(elever[0], fagId);

    const dagId = await opprettSamtaledag(skolearId, {
      skolearFagId: fagId,
      vurderingId,
      dato: "2026-11-24",
      fra: "08:30",
      til: "15:00",
      lunsjFra: null,
      lunsjMin: null,
    });
    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "09:00", varighetMin: 20, tema: "Oppgave 1" },
    ]);
    const [forste] = await hentSamtaler(dagId);
    await settMotte(forste.id, false);
    await lagreTrekning(dagId, [
      { elevId: elever[0], klokkeslett: "14:00", varighetMin: 20, tema: "Oppgave 1" },
    ]);

    const rader = await hentVurderingElever(vurderingId, fagId);
    expect(rader).toHaveLength(1);
    // Den hen faktisk møtte til vinner.
    expect(rader[0].samtaletid).toBe("2026-11-24 14:00");
  });
});
