import { describe, expect, it } from "vitest";
import { nesteTrinn, ZOOMTRINN } from "./zoom";

describe("zoomtrinn (10.6)", () => {
  it("går 80–90–100–110–125–150 %", () => {
    expect([...ZOOMTRINN]).toEqual([0.8, 0.9, 1, 1.1, 1.25, 1.5]);
  });

  it("går ett trinn opp og ned", () => {
    expect(nesteTrinn(1, 1)).toBe(1.1);
    expect(nesteTrinn(1.1, 1)).toBe(1.25);
    expect(nesteTrinn(1, -1)).toBe(0.9);
  });

  it("stopper i endene", () => {
    expect(nesteTrinn(1.5, 1)).toBe(1.5);
    expect(nesteTrinn(0.8, -1)).toBe(0.8);
  });

  it("finner nærmeste trinn fra en verdi mellom to", () => {
    expect(nesteTrinn(1.05, 1)).toBe(1.1);
    expect(nesteTrinn(1.05, -1)).toBe(1);
  });
});
