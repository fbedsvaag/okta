import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, hentForDuplikatsjekk, koblePaFag, hentElever } =
  await import("../data/elever");
const { leggFagIAr } = await import("../data/fag");
const { opprettSkolear } = await import("../data/skolear");
const { parseListe } = await import("./parser");
const { vurderImport } = await import("./duplikat");
const { tilImportrader, utforImport } = await import("./utfor");

let ar = "";
let fag = "";

beforeEach(async () => {
  base.nullstill();
  ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
});

async function importer(
  tekst: string,
  endre?: (r: ReturnType<typeof tilImportrader>) => void,
) {
  const v = vurderImport(
    parseListe(tekst).elever,
    await hentForDuplikatsjekk(ar),
    {
      skolearFagId: fag,
      valgtKlasse: null,
    },
  );
  const rader = tilImportrader(v, "");
  endre?.(rader);
  return utforImport(rader, ar, fag);
}

describe("navnet fra lista slår det som ble skrevet inn", () => {
  it("gir eleven det fulle navnet, uten å lage en ny", async () => {
    const per = await opprettElev("Per", "Person");
    await koblePaFag(per, fag);
    const r = await importer("Per Johannes Persaune Person");
    expect(r.elevIder.get(1)).toBe(per);
    const elever = await hentElever(ar);
    expect(elever).toHaveLength(1);
    expect(`${elever[0].fornavn} ${elever[0].etternavn}`).toBe(
      "Per Johannes Persaune Person",
    );
  });

  it("lar navnet stå når boksen tas av", async () => {
    await opprettElev("Per", "Person");
    await importer("Per Johannes Persaune Person", (rader) => {
      rader[0].byttNavn = false;
    });
    const [e] = await hentElever(ar);
    expect(`${e.fornavn} ${e.etternavn}`).toBe("Per Person");
  });
});
