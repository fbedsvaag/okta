import { describe, expect, it } from "vitest";
import { kartTast } from "./oktkart";

describe("tastene for kartkortet i økta (27.1)", () => {
  it("K veksler, men ikke mens du skriver i et felt", () => {
    expect(kartTast({ key: "k", skriver: false }, false)).toBe("veksle");
    expect(kartTast({ key: "K", skriver: false }, true)).toBe("veksle");
    expect(kartTast({ key: "k", skriver: true }, false)).toBeNull();
    expect(kartTast({ key: "k", skriver: true }, true)).toBeNull();
  });

  it("⌘K er søket, ikke kortet", () => {
    expect(
      kartTast({ key: "k", metaKey: true, skriver: false }, false),
    ).toBeNull();
    expect(
      kartTast({ key: "k", ctrlKey: true, skriver: false }, false),
    ).toBeNull();
  });

  it("esc lukker kortet først, og lar økta være når kortet er lukket", () => {
    expect(kartTast({ key: "Escape", skriver: false }, true)).toBe("lukk");
    expect(kartTast({ key: "Escape", skriver: true }, true)).toBe("lukk");
    expect(kartTast({ key: "Escape", skriver: false }, false)).toBeNull();
  });
});
