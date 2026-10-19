import { describe, expect, it } from "vitest";
import { nyttValg } from "./Flervalg";
import { angreSiste, leggTilAngring, tomAngring } from "./angre";

const rekke = ["a", "b", "c", "d", "e"];

describe("nyttValg", () => {
  it("slår en rad av og på", () => {
    expect([...nyttValg(new Set(), rekke, "b", null, false)]).toEqual(["b"]);
    expect([...nyttValg(new Set(["b"]), rekke, "b", "b", false)]).toEqual([]);
  });

  it("legger til et spenn med ⇧, begge veier", () => {
    expect([...nyttValg(new Set(["b"]), rekke, "d", "b", true)].sort()).toEqual(
      ["b", "c", "d"],
    );
    expect([...nyttValg(new Set(), rekke, "a", "c", true)].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("angre", () => {
  it("angrer den siste først, og bare én gang", async () => {
    tomAngring();
    const gjort: string[] = [];
    leggTilAngring({ tekst: "en", angre: () => void gjort.push("en") });
    leggTilAngring({ tekst: "to", angre: () => void gjort.push("to") });
    expect(await angreSiste()).toBe("to");
    expect(await angreSiste()).toBe("en");
    expect(await angreSiste()).toBeNull();
    expect(gjort).toEqual(["to", "en"]);
  });
});
