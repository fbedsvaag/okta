import { describe, expect, it } from "vitest";
import { MarkdownManager } from "@tiptap/markdown";
import { NOTATUTVIDELSER } from "./Notat";

const md = new MarkdownManager({ extensions: NOTATUTVIDELSER });
const rundt = (t: string) => md.serialize(md.parse(t)).trim();

describe("notat-editoren lagrer Markdown (28.4, 29.1)", () => {
  it("overskrifter, lister, sjekklister og fet/kursiv går fram og tilbake", () => {
    for (const t of [
      "# Overskrift",
      "## Mindre",
      "- en\n- to",
      "1. en\n2. to",
      "- [ ] gjøremål\n- [x] ferdig",
      "**fet** og *kursiv*",
      "Vanlig tekst.",
    ])
      expect(rundt(t)).toBe(t);
  });

  it("gamle notater med tom linje mellom avsnitt beholdes", () => {
    expect(rundt("Første avsnitt.\n\nAndre avsnitt.")).toBe(
      "Første avsnitt.\n\nAndre avsnitt.",
    );
  });
});
