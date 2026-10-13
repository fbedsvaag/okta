import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async () => "") }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { opprettSkolear, hentSkolear } = await import("./skolear");
const { leggFagIAr } = await import("./fag");
const { opprettOkt, endreOkt } = await import("./okter");
const { start, VENT_MS } = await import("./kalenderfeed");

const stromminger = () =>
  invoke.mock.calls.filter((k) => (k as unknown[])[0] === "sett_kalenderfeed");

beforeEach(() => {
  base.nullstill();
  invoke.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("kalenderstrømmen følger endringene (#3)", () => {
  it("bygges på nytt når en økt endres", async () => {
    const id = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const fag = await leggFagIAr(id, "NOR3", "Norsk", null);
    const okt = await opprettOkt(fag, "NOR3", "2026-10-13", "08:30", 90);
    const [ar] = await hentSkolear();

    await start(ar);
    expect(stromminger()).toHaveLength(1);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await endreOkt(okt, { tema: "Hamsun" });
    await vi.advanceTimersByTimeAsync(VENT_MS + 10);
    vi.useRealTimers();
    await vi.waitFor(() => expect(stromminger()).toHaveLength(2));
    const ics = (stromminger()[1] as unknown as [string, { ics: string }])[1]
      .ics;
    expect(ics).toContain("Hamsun");
  });
});
