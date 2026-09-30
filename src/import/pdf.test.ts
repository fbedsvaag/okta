import { describe, expect, it } from "vitest";
import { innenforKantene } from "./pdf";

/** Et lite bilde: hvitt, med et mørkt felt fra (x0,y0) til (x1,y1). */
function bilde(
  b: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const data = new Uint8ClampedArray(b * h * 4).fill(255);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * b + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 60;
    }
  return { width: b, height: h, data };
}

describe("innenforKantene", () => {
  it("skjærer bort hvite kanter over, under og på sidene", () => {
    expect(innenforKantene(bilde(40, 60, 2, 10, 38, 50))).toEqual({
      x: 2,
      y: 10,
      w: 36,
      h: 40,
    });
  });

  it("lar et bilde uten kanter være som det er", () => {
    expect(innenforKantene(bilde(20, 20, 0, 0, 20, 20))).toEqual({
      x: 0,
      y: 0,
      w: 20,
      h: 20,
    });
  });
});
