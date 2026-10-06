import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElevnotat, endreElevnotat } = await import("./elevnotat");
const { leggFagIAr } = await import("./fag");
const { opprettSamtaledag, lagreTrekning, hentSamtaler } =
  await import("./samtale");
const { opprettElev, koblePaFag } = await import("./elever");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering, hentVurderingElever } = await import("./vurderinger");

/** Karakter 1–6, seedet i migrasjon 002. */
const SKALA = "5ca1a000-0000-4000-8000-000000000004";

/**
 * Notatet fra en samtale bor i møteloggen, og vurderingslista leser det
 * derfra. Ett sted å skrive, to steder å se det.
 */
describe("samtalenotatet i vurderingslista", () => {
  let fag = "";
  let vurdering = "";
  let elev = "";
  let skolear = "";
  let samtale = "";
  let dag = "";

  beforeEach(async () => {
    base.nullstill();
    skolear = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    fag = await leggFagIAr(skolear, "MFL2", "Markedsføring", null);
    elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fag);
    vurdering = await opprettVurdering(
      fag,
      SKALA,
      "Muntlig — prisstrategi",
      "muntlig",
      null,
    );
    dag = await opprettSamtaledag(skolear, {
      skolearFagId: fag,
      vurderingId: vurdering,
      dato: "2026-10-15",
      fra: "08:30",
      til: "15:30",
      lunsjFra: null,
      lunsjMin: null,
    });
    await lagreTrekning(dag, [
      { elevId: elev, klokkeslett: "08:30", varighetMin: 20, tema: "Skumming" },
    ]);
    samtale = (await hentSamtaler(dag))[0].id;
  });

  it("står ved eleven, og følger med når notatet endres", async () => {
    const id = await opprettElevnotat(elev, skolear, {
      dato: "2026-10-15",
      tekst: "God på kostnadsbasert",
      skolearFagId: fag,
      samtaleId: samtale,
    });
    let [rad] = await hentVurderingElever(vurdering, fag);
    expect(rad.samtalenotat).toBe("God på kostnadsbasert");
    expect(rad.oppgave).toBe("Skumming");

    await endreElevnotat(id, {
      tekst: "God på kostnadsbasert, svak på skumming",
    });
    [rad] = await hentVurderingElever(vurdering, fag);
    expect(rad.samtalenotat).toBe("God på kostnadsbasert, svak på skumming");
  });

  it("er tom uten notat, og overlever en ny trekning", async () => {
    let [rad] = await hentVurderingElever(vurdering, fag);
    expect(rad.samtalenotat).toBeNull();

    await opprettElevnotat(elev, skolear, {
      dato: "2026-10-15",
      tekst: "Møtte forberedt",
      skolearFagId: fag,
      samtaleId: samtale,
    });
    // En ny trekning erstatter samtaleradene; notatet skal stå like fullt.
    await lagreTrekning(dag, [
      { elevId: elev, klokkeslett: "09:00", varighetMin: 20, tema: "Skumming" },
    ]);
    [rad] = await hentVurderingElever(vurdering, fag);
    expect(rad.samtalenotat).toBe("Møtte forberedt");
  });
});
