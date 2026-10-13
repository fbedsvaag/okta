import { describe, expect, it } from "vitest";
import {
  bevegelseshjelp,
  filbehandler,
  glasshjelp,
  nokkelringen,
  synkadvarsel,
  systemnavn,
} from "./plattformord";

describe("plattformord", () => {
  it("nøkkelringen heter Windows legitimasjonsbehandling på Windows", () => {
    expect(nokkelringen(true)).toBe("nøkkelringen");
    expect(nokkelringen(false)).toBe("Windows legitimasjonsbehandling");
  });

  it("Finder er Filutforsker, macOS er Windows", () => {
    expect(filbehandler(true)).toBe("Finder");
    expect(filbehandler(false)).toBe("Filutforsker");
    expect(systemnavn(true)).toBe("macOS");
    expect(systemnavn(false)).toBe("Windows");
  });

  it("synkadvarselen nevner OneDrive og Dokumenter på Windows", () => {
    expect(synkadvarsel(true)).toContain("iCloud");
    expect(synkadvarsel(true)).not.toContain("OneDrive");
    expect(synkadvarsel(false)).toContain("OneDrive");
    expect(synkadvarsel(false)).toContain("Dokumenter");
    expect(synkadvarsel(false)).not.toContain("iCloud");
  });

  it("ingen Mac-ord i Windows-tekstene", () => {
    for (const t of [
      glasshjelp(false),
      bevegelseshjelp(false),
      synkadvarsel(false),
    ]) {
      expect(t).not.toMatch(/macOS|Mac\b|Finder|iCloud|FileVault/);
    }
    expect(bevegelseshjelp(false)).toContain("«Som Windows»");
    expect(bevegelseshjelp(true)).toContain("«Som macOS»");
  });
});
