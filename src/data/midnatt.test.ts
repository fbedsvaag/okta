import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

/**
 * Datoen rett etter midnatt (#7). Testene går på norsk tid (vite.config.ts);
 * 00:30 den 14. oktober er 22:30 den 13. i UTC.
 */

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { idag, hent } = await import("../db");
const { opprettSkolear } = await import("./skolear");
const { opprettElev } = await import("./elever");
const { opprettElevnotat, settLukket, hentForfalte } =
  await import("./elevnotat");

beforeEach(() => {
  base.nullstill();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Stiller klokka etter at testdataene er laget. */
function klokka(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

describe("i dag rett etter midnatt (#7)", () => {
  it("idag() er den nye dagen kl. 00:30, vinter og sommer", () => {
    klokka("2026-10-26T00:30:00+01:00"); // vintertid
    expect(idag()).toBe("2026-10-26");
    klokka("2026-10-14T00:30:00+02:00"); // sommertid
    expect(idag()).toBe("2026-10-14");
  });

  it("et punkt som lukkes kl. 00:30, lukkes den nye dagen", async () => {
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const elev = await opprettElev("Tony", "Soprano");
    const id = await opprettElevnotat(elev, ar, {
      dato: "2026-10-12",
      tekst: "Følg opp",
      skalFolgesOpp: true,
      frist: "2026-10-13",
    });
    klokka("2026-10-14T00:30:00+02:00");
    expect(await hentForfalte(ar)).toEqual(new Set([elev]));
    await settLukket(id, true);
    const [rad] = await hent<{ lukket: string }>(
      "SELECT lukket FROM elevnotat WHERE id = $1",
      [id],
    );
    expect(rad.lukket).toBe("2026-10-14");
  });
});
