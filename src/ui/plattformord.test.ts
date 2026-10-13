import { describe, expect, it } from "vitest";
import { nokkelringen } from "./plattformord";

describe("plattformord", () => {
  it("nøkkelringen heter Windows legitimasjonsbehandling på Windows", () => {
    expect(nokkelringen(true)).toBe("nøkkelringen");
    expect(nokkelringen(false)).toBe("Windows legitimasjonsbehandling");
  });
});
