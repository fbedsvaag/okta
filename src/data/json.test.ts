import { describe, expect, it, vi } from "vitest";
import { lesJson } from "./json";

describe("lesJson (#6)", () => {
  it("leser gyldig JSON", () => {
    expect(lesJson('["a","b"]', [])).toEqual(["a", "b"]);
  });

  it("gir standardverdien for tom verdi", () => {
    expect(lesJson(null, ["x"])).toEqual(["x"]);
    expect(lesJson("", [])).toEqual([]);
  });

  it("gir standardverdien og en advarsel for ødelagt JSON", () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(lesJson("[ødelagt", [], "temaene")).toEqual([]);
    expect(advarsel).toHaveBeenCalledOnce();
    advarsel.mockRestore();
  });
});
