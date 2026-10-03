import { describe, expect, it } from "vitest";
import { checkPublishable, guidedQuestions, stripPersonal, validateContent } from "@madeforyou/schema";
import { templates } from "../src";

describe("launch templates", () => {
  it("has unique ids", () => {
    const ids = templates.map((t) => t.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes search synonyms (maa / mom / amma)", () => {
    const t = templates.find((x) => x.meta.id === "mothers-day-letter")!;
    expect(t.meta.tags).toEqual(expect.arrayContaining(["maa", "mom", "amma"]));
  });

  for (const t of templates) {
    describe(t.meta.id, () => {
      it("only translates into declared languages", () => {
        const declared = new Set(t.meta.languages);
        for (const b of t.content.blocks) for (const lang of Object.keys(b.i18n ?? {})) expect(declared.has(lang)).toBe(true);
        expect(t.content.settings.languages.available.every((l) => declared.has(l))).toBe(true);
      });

      it("cannot be published as-is, so sample text never goes live", () => {
        expect(checkPublishable(t.content).canPublish).toBe(false);
      });

      it("produces guided questions, starting with the recipient or name", () => {
        const qs = guidedQuestions(t.content);
        expect(qs.length).toBeGreaterThan(0);
        expect(qs.some((q) => q.tier === "essential")).toBe(true);
      });

      it("survives being stripped and stays valid", () => {
        const { content } = stripPersonal(t.content);
        expect(validateContent(content).ok).toBe(true);
      });
    });
  }
});
