import { describe, expect, it } from "vitest";
import { innenforAret, teamstekst } from "./okter";

const ar = { start: "2026-08-17", slutt: "2027-06-20" };

describe("innenforAret", () => {
  it("tar med øktene inne i spennet", () => {
    const okter = [{ dato: "2026-09-01" }, { dato: "2027-03-15" }];
    expect(innenforAret(okter, ar.start, ar.slutt)).toEqual(okter);
  });

  it("holder utenfor det som ligger før skolestart", () => {
    // Dette er den faktiske feilen: en serie som begynte to uker for tidlig
    // la seks timer til timeregnskapet uten å høre til året.
    const okter = [{ dato: "2026-08-04" }, { dato: "2026-08-11" }];
    expect(innenforAret(okter, ar.start, ar.slutt)).toEqual([]);
  });

  it("holder utenfor det som ligger etter skoleslutt", () => {
    expect(innenforAret([{ dato: "2027-06-21" }], ar.start, ar.slutt)).toEqual([]);
  });

  it("regner første og siste skoledag som innenfor", () => {
    const kanter = [{ dato: ar.start }, { dato: ar.slutt }];
    expect(innenforAret(kanter, ar.start, ar.slutt)).toEqual(kanter);
  });

  it("tåler en tom liste", () => {
    expect(innenforAret([], ar.start, ar.slutt)).toEqual([]);
  });
});

describe("teamstekst", () => {
  const okt = {
    fagKode: "MFL1",
    dato: "2026-09-15",
    klokkeslett: "09:15",
    tema: "Markedsanalyse",
    agenda: "Ta med PC.",
  };

  it("setter fag, tidspunkt, tema og agenda under hverandre", () => {
    expect(teamstekst(okt)).toBe(
      "MFL1 — tirsdag 15. september, 09:15\n\nMarkedsanalyse\n\nTa med PC.",
    );
  });

  it("utelater klokkeslettet når økta ikke har et", () => {
    expect(teamstekst({ ...okt, klokkeslett: null })).toBe(
      "MFL1 — tirsdag 15. september\n\nMarkedsanalyse\n\nTa med PC.",
    );
  });

  it("hopper over tomme felter i stedet for å legge igjen blanke linjer", () => {
    expect(teamstekst({ ...okt, tema: null, agenda: "   " })).toBe(
      "MFL1 — tirsdag 15. september, 09:15",
    );
  });

  it("tar aldri med plan eller øktlogg", () => {
    // Samme feltgrense som kalenderpubliseringen (§8.1): lærerens egne
    // notater går aldri ut, uansett hvor de limes inn.
    const ut = teamstekst({ ...okt, agenda: "Ta med PC." });
    expect(ut).not.toContain("plan");
    expect(ut).toBe("MFL1 — tirsdag 15. september, 09:15\n\nMarkedsanalyse\n\nTa med PC.");
  });
});
