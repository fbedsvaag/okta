import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

/**
 * Raske tastetrykk (#8): to skrivinger til samme rad som starter før den
 * første er ferdig. Med «finnes raden? så UPDATE eller INSERT» spør begge
 * før noen har skrevet, begge prøver INSERT, og den andre feiler på UNIQUE.
 */

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { hent } = await import("../db");
const { opprettSkolear } = await import("./skolear");
const { leggFagIAr } = await import("./fag");
const { opprettElev, settKlasse, finnEllerOpprettKlasse } =
  await import("./elever");
const { opprettOkt, settSkaring, settSkaringsnotat } = await import("./okter");
const { settElevbilde } = await import("./elevbilde");

const GUL = "5ca1ade1-0001-4000-8000-000000000003";
const GRONN = "5ca1ade1-0001-4000-8000-000000000004";

let ar = "";
let elev = "";
let okt = "";

beforeEach(async () => {
  base.nullstill();
  ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  const fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
  elev = await opprettElev("Tony", "Soprano");
  okt = await opprettOkt(fag, "MFL1", "2026-09-01", "08:30", 90);
});

describe("to raske skrivinger til samme rad (#8)", () => {
  it("skåring: 2 og så 3 gir én rad med grønn", async () => {
    await Promise.all([
      settSkaring(elev, okt, GUL),
      settSkaring(elev, okt, GRONN),
    ]);
    const rader = await hent<{ skalaverdi_id: string }>(
      "SELECT skalaverdi_id FROM skaring WHERE elev_id = $1 AND okt_id = $2",
      [elev, okt],
    );
    expect(rader).toEqual([{ skalaverdi_id: GRONN }]);
  });

  it("skåring igjen etter at den er fjernet, gjenbruker raden", async () => {
    await settSkaring(elev, okt, GUL);
    await base.execute("UPDATE skaring SET slettet = 'x'");
    await settSkaring(elev, okt, GRONN);
    const rader = await hent<{ skalaverdi_id: string; slettet: unknown }>(
      "SELECT skalaverdi_id, slettet FROM skaring",
    );
    expect(rader).toEqual([{ skalaverdi_id: GRONN, slettet: null }]);
  });

  it("notat i økta", async () => {
    await Promise.all([
      settSkaringsnotat(elev, okt, "først"),
      settSkaringsnotat(elev, okt, "så"),
    ]);
    const rader = await hent<{ tekst: string }>("SELECT tekst FROM oktnotat");
    expect(rader).toEqual([{ tekst: "så" }]);
  });

  it("elevbilde", async () => {
    await Promise.all([
      settElevbilde(elev, "data:a", "test"),
      settElevbilde(elev, "data:b", "test"),
    ]);
    const rader = await hent<{ bilde: string }>("SELECT bilde FROM elevbilde");
    expect(rader).toEqual([{ bilde: "data:b" }]);
  });

  it("klasse", async () => {
    const a = await finnEllerOpprettKlasse(ar, "3STA");
    const b = await finnEllerOpprettKlasse(ar, "3STB");
    await Promise.all([settKlasse(elev, ar, a), settKlasse(elev, ar, b)]);
    const rader = await hent<{ klasse_id: string }>(
      "SELECT klasse_id FROM elev_klasse",
    );
    expect(rader).toEqual([{ klasse_id: b }]);
  });
});
