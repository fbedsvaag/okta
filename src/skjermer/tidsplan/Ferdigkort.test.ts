import { describe, expect, it } from "vitest";
import { ferdiglinje } from "./Ferdigkort";

describe("Alle samtalene er holdt (31.4)", () => {
  it("teller holdt, møtte ikke og snittet av tallkarakterer", () => {
    expect(
      ferdiglinje({
        holdt: 13,
        motteIkke: 1,
        karakterer: [
          { kode: "4", teller_ikke: 0 },
          { kode: "5", teller_ikke: 0 },
          { kode: "3", teller_ikke: 0 },
          { kode: "IV", teller_ikke: 1 },
        ],
      }),
    ).toBe("13 samtaler holdt · 1 møtte ikke · snitt 4");
  });

  it("har ikke snitt for ord, og viser foresatt for mentorsamtaler", () => {
    expect(
      ferdiglinje({
        holdt: 1,
        motteIkke: 0,
        medForesatt: 1,
        karakterer: [{ kode: "Godkjent", teller_ikke: 0 }],
      }),
    ).toBe("1 samtale holdt · 1 med foresatt");
  });
});
