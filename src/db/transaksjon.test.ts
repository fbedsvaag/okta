import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "./testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { Transaksjon, hent } = await import(".");

beforeEach(() => base.nullstill());

describe("Transaksjon (#2)", () => {
  it("lagrer alt når alt går gjennom", async () => {
    const t = new Transaksjon();
    const id = t.settInn("elev", { fornavn: "Tony", etternavn: "Soprano" });
    t.oppdater("elev", id, { fornavn: "Anthony" });
    await t.kjor();
    const [e] = await hent<{ fornavn: string; slettet: string | null }>(
      "SELECT fornavn, slettet FROM elev WHERE id = $1",
      [id],
    );
    expect(e).toEqual({ fornavn: "Anthony", slettet: null });
  });

  it("lagrer ingenting når én setning feiler", async () => {
    const t = new Transaksjon();
    t.settInn("elev", { fornavn: "Tony", etternavn: "Soprano" });
    t.settInn("elev", { fornavn: null, etternavn: "Ingen" }); // NOT NULL
    await expect(t.kjor()).rejects.toThrow();
    const [{ n }] = await hent<{ n: number }>("SELECT COUNT(*) AS n FROM elev");
    expect(n).toBe(0);
  });

  it("gjør ingenting uten setninger", async () => {
    await new Transaksjon().kjor();
  });
});
