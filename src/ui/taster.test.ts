import { describe, expect, it } from "vitest";
import { harModifikator, hovedtast, nettleserSnarvei, tast } from "./taster";

const ingen = {
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
};
const cmd = { ...ingen, metaKey: true };
const ctrl = { ...ingen, ctrlKey: true };

describe("hovedtast", () => {
  it("er ⌘ på Mac", () => {
    expect(hovedtast(cmd, true)).toBe(true);
    expect(hovedtast(ctrl, true)).toBe(false);
  });
  it("er Ctrl på Windows", () => {
    expect(hovedtast(ctrl, false)).toBe(true);
    // Windows-tasten er metaKey der; den er ikke en snarveistast.
    expect(hovedtast(cmd, false)).toBe(false);
  });
  it("uten modifikator er ingen av dem", () => {
    expect(hovedtast(ingen, true)).toBe(false);
    expect(hovedtast(ingen, false)).toBe(false);
    expect(harModifikator(ingen)).toBe(false);
    expect(harModifikator(cmd)).toBe(true);
    expect(harModifikator(ctrl)).toBe(true);
  });
});

describe("tast", () => {
  it("lar Mac-tegnene stå på Mac", () => {
    for (const s of ["⌘K", "⇧⌘E", "⌥↑", "⌘↵", "⌘1", "⌘,"])
      expect(tast(s, true)).toBe(s);
  });
  it("skriver ut Ctrl, Shift og Alt på Windows", () => {
    expect(tast("⌘K", false)).toBe("Ctrl+K");
    expect(tast("⌘,", false)).toBe("Ctrl+,");
    expect(tast("⌘1", false)).toBe("Ctrl+1");
    expect(tast("⇧⌘E", false)).toBe("Ctrl+Shift+E");
    expect(tast("⌥↑", false)).toBe("Alt+↑");
    expect(tast("⌘↵", false)).toBe("Ctrl+Enter");
    expect(tast("⌘[", false)).toBe("Ctrl+[");
    expect(tast("⌫", false)).toBe("Backspace");
    expect(tast("⌘", false)).toBe("Ctrl");
  });
  it("lar taster uten modifikator stå", () => {
    expect(tast("R", false)).toBe("R");
    expect(tast("G D", false)).toBe("G D");
  });
});

describe("nettleserSnarvei", () => {
  const med = (key: string, m = ctrl) => ({ ...m, key });
  it("fanger Ctrl+P, F, R, W og F5 på Windows", () => {
    for (const k of ["p", "P", "f", "r", "w", "g"])
      expect(nettleserSnarvei(med(k), false)).toBe(true);
    expect(nettleserSnarvei(med("F5", ingen), false)).toBe(true);
  });
  it("slipper vanlige redigeringstaster gjennom", () => {
    for (const k of ["a", "c", "v", "x", "z", "b", "i", "k"])
      expect(nettleserSnarvei(med(k), false)).toBe(false);
    expect(nettleserSnarvei(med("p", ingen), false)).toBe(false);
  });
  it("gjør ingenting på Mac", () => {
    expect(nettleserSnarvei(med("p", cmd), true)).toBe(false);
    expect(nettleserSnarvei(med("r", ctrl), true)).toBe(false);
  });
});
