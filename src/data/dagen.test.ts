import { describe, expect, it } from "vitest";
import { dagen, forrigeOkt } from "./dagen";

const o = (
  id: string,
  dato: string,
  over: Partial<{
    skolearFagId: string;
    fagKode: string;
    klokkeslett: string | null;
    logg: string | null;
  }> = {},
) => ({
  id,
  dato,
  skolearFagId: "mfl",
  fagKode: "MFL1",
  klokkeslett: "09:15",
  logg: null,
  ...over,
});

describe("forrigeOkt", () => {
  it("er økta rett før i samme fag, også når den ikke har notat", () => {
    const alle = [
      o("a", "2026-09-22", { logg: "gammelt" }),
      o("b", "2026-09-29"),
      o("c", "2026-09-30"),
      o("x", "2026-09-29", { skolearFagId: "eng" }),
    ];
    expect(forrigeOkt(alle[2], alle)?.id).toBe("b");
  });

  it("skiller to økter samme dag på klokkeslettet", () => {
    const alle = [
      o("tidlig", "2026-09-30", { klokkeslett: "08:15" }),
      o("sen", "2026-09-30", { klokkeslett: "12:30" }),
    ];
    expect(forrigeOkt(alle[1], alle)?.id).toBe("tidlig");
    expect(forrigeOkt(alle[0], alle)).toBeNull();
  });
});

describe("dagen", () => {
  it("sier hvor mange økter, i hvilke fag, og notatet fra sist", () => {
    const alle = [
      o("a", "2026-09-29", { logg: "Husk oppgavearket" }),
      o("b", "2026-09-30"),
    ];
    const d = dagen(alle, "2026-09-30");
    expect(d.setning).toBe("Én økt i dag: MFL1 kl. 09:15.");
    expect(d.linjer[0].notat).toBe("Husk oppgavearket");
  });

  it("lister flere økter i tidsrekkefølge", () => {
    const alle = [
      o("e", "2026-09-30", {
        skolearFagId: "eng",
        fagKode: "ENG1",
        klokkeslett: "12:30",
      }),
      o("m", "2026-09-30"),
    ];
    const d = dagen(alle, "2026-09-30");
    expect(d.setning).toBe("To økter i dag: MFL1 kl. 09:15 og ENG1 kl. 12:30.");
    expect(d.linjer.map((l) => l.notat)).toEqual([null, null]);
  });

  it("sier fra når det ikke er noen økter", () => {
    expect(dagen([], "2026-09-30").setning).toBe("Ingen økter i dag.");
  });
});
