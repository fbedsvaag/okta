import { describe, expect, it } from "vitest";
import { innenforAret } from "./okter";

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
