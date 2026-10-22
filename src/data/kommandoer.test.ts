import { describe, expect, it } from "vitest";
import {
  erHjelp,
  erTasteliste,
  finnHjelp,
  HJELP,
  sokKommandoer,
  type Kommando,
} from "./kommandoer";

const k = (id: string, navn: string, ord = ""): Kommando => ({
  id,
  gruppe: "Gjør",
  navn,
  ord,
  gjor: () => {},
});

describe("kommandoene i ⌘K", () => {
  const alle = [
    k("a", "Ny vurdering", "prøve muntlig"),
    k("b", "Lag grupper", "stokk"),
    k("c", "Ta sikkerhetskopi nå", "backup"),
  ];

  it("finner på navn og andre ord, og navnet som begynner likt først", () => {
    expect(sokKommandoer("backup", alle).map((x) => x.id)).toEqual(["c"]);
    expect(sokKommandoer("lag gru", alle).map((x) => x.id)).toEqual(["b"]);
    expect(sokKommandoer("", alle)).toEqual([]);
  });

  it("kjenner igjen hjelp og hurtigtaster", () => {
    expect(erHjelp("hvordan lager jeg grupper")).toBe(true);
    expect(erHjelp("Hjelp")).toBe(true);
    expect(erHjelp("flytte økt?")).toBe(true);
    expect(erHjelp("tony")).toBe(false);
    expect(erTasteliste(" ? ")).toBe(true);
  });

  it("svarer på spørsmålet som passer, også med bøyde ord", () => {
    expect(finnHjelp("hvordan lager jeg grupper")[0].sporsmal).toMatch(
      /grupper/,
    );
    expect(finnHjelp("hvordan flytter jeg en økt")[0].sporsmal).toMatch(
      /flytter/,
    );
    expect(finnHjelp("hvordan")).toHaveLength(4);
    expect(finnHjelp("hvordan zzzz")).toEqual([]);
  });

  it("hver hjelp har en knapp som peker på en kommando appen har", () => {
    const kjente = new Set([
      "ga:klassekart",
      "ga:okter",
      "ga:vurderinger",
      "ga:idag",
      "ga:liminn",
      "kopi",
      "innst:fag",
      "taster",
    ]);
    for (const h of HJELP) expect(kjente.has(h.kommando)).toBe(true);
  });
});
