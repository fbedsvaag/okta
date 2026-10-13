import { describe, expect, it } from "vitest";
import { skjermnavn, tilbakemeldingslinje } from "./tilbakemelding";

describe("tilbakemeldingslinje", () => {
  it("har versjon, system og skjerm", () => {
    expect(tilbakemeldingslinje("0.3.0", "macOS 15.1", "elev")).toBe(
      "Økta 0.3.0 · macOS 15.1 · Skjerm: Elevkort",
    );
    expect(tilbakemeldingslinje("0.3.0", "Windows 11 (26100)", "idag")).toBe(
      "Økta 0.3.0 · Windows 11 (26100) · Skjerm: I dag",
    );
  });

  it("slipper aldri gjennom noe annet enn faste skjermnavn", () => {
    // En visning appen ikke kjenner, eller noe som ligner innhold, blir
    // «Ukjent», ikke teksten selv.
    expect(skjermnavn("Tony Soprano")).toBe("Ukjent");
    expect(skjermnavn("")).toBe("Ukjent");
  });
});
