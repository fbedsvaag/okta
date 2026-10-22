import { describe, expect, it } from "vitest";
import { byggOversikt, filtrer, type Samtalelinje } from "./vurderingsoversikt";
import type { Vurdering } from "./vurderinger";
import type { Samtaledag } from "./samtale";

const v = (o: Partial<Vurdering>): Vurdering => ({
  id: "v",
  skolearFagId: "f1",
  fagKode: "MFL1",
  farge: null,
  skalaId: "s",
  skalaNavn: "Karakter 1–6",
  tittel: "Prøve",
  type: "skriftlig",
  frist: null,
  oktIder: [],
  beskrivelse: null,
  utkast: 0,
  fort: 0,
  elever: 10,
  levert: 0,
  oktDato: null,
  snitt: null,
  ...o,
});

const dag = (o: Partial<Samtaledag>): Samtaledag => ({
  id: "d",
  skolearId: "a",
  samtalerundeId: null,
  skolearFagId: "f1",
  fagKode: "MFL1",
  vurderingId: null,
  oktId: null,
  dato: "2026-11-02",
  fra: "08:30",
  til: "12:00",
  lunsjFra: null,
  lunsjMin: null,
  antall: 2,
  ...o,
});

const linje = (o: Partial<Samtalelinje>): Samtalelinje => ({
  samtaledagId: "d",
  dato: "2026-11-02",
  klokkeslett: "08:30",
  varighetMin: 15,
  motte: true,
  fornavn: "Tony",
  etternavn: "Soprano",
  ...o,
});

// mandag 2.11.2026 kl. 08:40
const NAA = new Date(2026, 10, 2, 8, 40);

describe("byggOversikt", () => {
  it("grupperer etter status", () => {
    const rader = byggOversikt({
      vurderinger: [
        v({ id: "kom", frist: "2026-11-05" }),
        v({ id: "for", frist: "2026-10-01", fort: 3 }),
        v({ id: "fer", frist: "2026-10-01", fort: 10, snitt: 4.25 }),
        v({ id: "utk", frist: "2026-10-01", utkast: 1 }),
      ],
      dager: [],
      linjer: [],
      harMentor: false,
      naa: NAA,
    });
    const g = Object.fromEntries(rader.map((r) => [r.id, r.gruppe]));
    expect(g).toEqual({
      kom: "kommende",
      for: "foring",
      fer: "ferdig",
      utk: "kommende",
    });
    expect(rader.find((r) => r.id === "fer")!.info).toBe("Snitt 4,3");
    expect(rader.find((r) => r.id === "for")!.info).toBe("3 av 10 ført");
  });

  it("slår sammen en muntlig vurdering og trekningen, og sier hvem som er inne", () => {
    const rader = byggOversikt({
      vurderinger: [v({ id: "m", type: "muntlig", tittel: "Muntlig: SWOT" })],
      dager: [dag({ vurderingId: "m" })],
      linjer: [
        linje({}),
        linje({ klokkeslett: "08:45", fornavn: "Paulie", etternavn: "W." }),
      ],
      harMentor: false,
      naa: NAA,
    });
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({
      gruppe: "na",
      pagar: true,
      info: "Pågår · Tony Soprano er inne",
      dato: "I dag 08:30–09:00",
    });
  });

  it("viser innlevering som levert før fristen", () => {
    const [r] = byggOversikt({
      vurderinger: [
        v({ type: "innlevering", frist: "2026-11-13", levert: 4, fort: 0 }),
      ],
      dager: [],
      linjer: [],
      harMentor: false,
      naa: NAA,
    });
    expect(r.info).toBe("4 av 10 levert");
    expect(r.ant).toBe(4);
    expect(r.dato).toMatch(/^frist /);
  });

  it("viser mentorsamtaler bare for den som har mentorelever", () => {
    const inn = {
      vurderinger: [],
      dager: [dag({ skolearFagId: null, fagKode: null, dato: "2026-10-20" })],
      linjer: [linje({ dato: "2026-10-20" })],
      naa: NAA,
    };
    expect(byggOversikt({ ...inn, harMentor: false })).toHaveLength(0);
    const [r] = byggOversikt({ ...inn, harMentor: true });
    expect(r).toMatchObject({
      type: "mentor",
      gruppe: "ferdig",
      ant: 1,
      av: 1,
    });
  });

  it("filtrerer på type og fag", () => {
    const rader = byggOversikt({
      vurderinger: [
        v({ id: "a", type: "muntlig" }),
        v({ id: "b", skolearFagId: "f2" }),
      ],
      dager: [],
      linjer: [],
      harMentor: false,
      naa: NAA,
    });
    expect(filtrer(rader, "muntlig", new Set()).map((r) => r.id)).toEqual([
      "a",
    ]);
    expect(filtrer(rader, "alle", new Set(["f2"])).map((r) => r.id)).toEqual([
      "b",
    ]);
  });
});
