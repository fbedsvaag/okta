import { describe, expect, it } from "vitest";
import { filnavnAv } from "./filer";

describe("filnavnAv", () => {
  it("tar filnavnet fra stier på Mac og Windows", () => {
    expect(filnavnAv("/Users/x/Desktop/Årsplan.md")).toBe("Årsplan.md");
    expect(filnavnAv(String.raw`C:\Users\x\Desktop\kart.png`)).toBe("kart.png");
    expect(filnavnAv("bare.okta")).toBe("bare.okta");
  });
});
