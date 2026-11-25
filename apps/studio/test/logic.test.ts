import { describe, expect, it } from "vitest";
import { createBlock, starterSkeleton, validateContent } from "@madeforyou/schema";
import {
  addBlock, blockSummary, duplicateBlock, editorReducer, initEditor, moveBlock, removeBlock, setStyle, toggleVisible,
} from "../src/state/editor";
import { SLUG_MESSAGES, humanize, parseMusic, slugStatus, slugSuggestions, slugify, waLink } from "../src/lib/util";
import { parseHash } from "../src/lib/router";

describe("editor operations", () => {
  it("adds a block after the selected one, with placeholders, and stays valid", () => {
    const c = starterSkeleton();
    const r = addBlock(c, "countdown", c.blocks[0]!.id);
    expect(r.content.blocks.map((b) => b.type)).toEqual(["hero", "countdown", "text", "gallery", "signature"]);
    expect(r.content.blocks[1]!.id).toBe(r.id);
    expect(validateContent(r.content).ok).toBe(true);
    expect(c.blocks).toHaveLength(4);
  });
  it("appends when nothing is selected", () => {
    const c = starterSkeleton();
    expect(addBlock(c, "letter").content.blocks.at(-1)!.type).toBe("letter");
  });
  it("moves blocks and stops at the ends", () => {
    const c = starterSkeleton();
    const [a, b] = c.blocks;
    expect(moveBlock(c, a!.id, 1).blocks[1]!.id).toBe(a!.id);
    expect(moveBlock(c, a!.id, -1)).toBe(c);
    expect(moveBlock(c, c.blocks.at(-1)!.id, 1)).toBe(c);
    expect(b).toBeTruthy();
  });
  it("duplicates with a new id and a deep copy", () => {
    const c = starterSkeleton();
    const r = duplicateBlock(c, c.blocks[1]!.id);
    expect(r.content.blocks).toHaveLength(5);
    expect(r.content.blocks[2]!.id).not.toBe(c.blocks[1]!.id);
    r.content.blocks[2]!.fields.heading = "changed";
    expect(c.blocks[1]!.fields.heading).not.toBe("changed");
    expect(validateContent(r.content).ok).toBe(true);
  });
  it("removes, hides and restyles", () => {
    const c = starterSkeleton();
    expect(removeBlock(c, c.blocks[0]!.id).blocks).toHaveLength(3);
    expect(toggleVisible(c, c.blocks[0]!.id).blocks[0]!.visible).toBe(false);
    expect(setStyle(c, c.blocks[0]!.id, { align: "left" }).blocks[0]!.style.align).toBe("left");
  });
  it("summarises a block by its first filled text", () => {
    const b = createBlock("hero");
    expect(blockSummary(b)).toBe("");
    b.fields.recipient = "Priya";
    b.ph = b.ph.filter((n) => n !== "recipient");
    expect(blockSummary(b)).toBe("Priya");
  });
});

describe("undo and redo", () => {
  const apply = (s: ReturnType<typeof initEditor>, key?: string) =>
    editorReducer(s, { type: "apply", key, fn: (c) => ({ ...c, blocks: [...c.blocks, createBlock("text")] }) });

  it("undoes and redoes", () => {
    let s = initEditor(starterSkeleton());
    s = apply(s);
    expect(s.content.blocks).toHaveLength(5);
    s = editorReducer(s, { type: "undo" });
    expect(s.content.blocks).toHaveLength(4);
    s = editorReducer(s, { type: "redo" });
    expect(s.content.blocks).toHaveLength(5);
  });
  it("a new change clears the redo stack", () => {
    let s = initEditor(starterSkeleton());
    s = apply(s);
    s = editorReducer(s, { type: "undo" });
    s = apply(s);
    expect(s.future).toHaveLength(0);
  });
  it("merges rapid edits with the same key into one undo step", () => {
    let s = initEditor(starterSkeleton());
    s = apply(s, "typing");
    s = apply(s, "typing");
    s = apply(s, "typing");
    expect(s.past).toHaveLength(1);
    s = editorReducer(s, { type: "undo" });
    expect(s.content.blocks).toHaveLength(4);
  });
  it("does not record no-op changes", () => {
    const s = initEditor(starterSkeleton());
    expect(editorReducer(s, { type: "apply", fn: (c) => c })).toBe(s);
  });
  it("caps history", () => {
    let s = initEditor(starterSkeleton());
    for (let i = 0; i < 130; i++) s = apply(s);
    expect(s.past.length).toBeLessThanOrEqual(100);
  });
});

describe("links and music", () => {
  it("slugifies", () => {
    expect(slugify("Priya's Birthday!")).toBe("priya-s-birthday");
    expect(slugify("  ---  ")).toBe("");
  });
  it("validates slugs", () => {
    const taken = (s: string) => s === "priya";
    expect(slugStatus("ab", taken)).toBe("short");
    expect(slugStatus("Priya", taken)).toBe("invalid");
    expect(slugStatus("a--b", taken)).toBe("invalid");
    expect(slugStatus("admin", taken)).toBe("reserved");
    expect(slugStatus("priya", taken)).toBe("taken");
    expect(slugStatus("priya-2026", taken)).toBe("ok");
    expect(SLUG_MESSAGES.ok).toMatch(/available/);
  });
  it("suggests free alternatives", () => {
    const s = slugSuggestions("priya", (x) => x === "priya");
    expect(s.length).toBeGreaterThan(0);
    expect(s).not.toContain("priya");
  });
  it("accepts YouTube and Spotify links only, as provider + id", () => {
    expect(parseMusic("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseMusic("https://youtu.be/dQw4w9WgXcQ?t=3")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseMusic("https://music.youtube.com/watch?v=dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(parseMusic("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x")).toEqual({ provider: "spotify", id: "4uLU6hMCjMI75M1A2tKUQC" });
    expect(parseMusic("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseMusic("javascript:alert(1)")).toBeNull();
    expect(parseMusic("not a link")).toBeNull();
    expect(parseMusic("https://www.youtube.com/watch?v=short")).toBeNull();
  });
  it("builds a WhatsApp link with the text encoded", () => {
    expect(waLink("hi there & bye")).toBe("https://wa.me/?text=hi%20there%20%26%20bye");
  });
  it("humanizes field names", () => {
    expect(humanize("endMessage")).toBe("End message");
  });
});

describe("routes", () => {
  it("parses every screen", () => {
    expect(parseHash("").name).toBe("home");
    expect(parseHash("#/templates?q=maa").query.get("q")).toBe("maa");
    expect(parseHash("#/t/mothers-day-letter").params.id).toBe("mothers-day-letter");
    expect(parseHash("#/make/pg_1").name).toBe("make");
    expect(parseHash("#/edit/pg_1?block=blk_a").query.get("block")).toBe("blk_a");
    expect(parseHash("#/publish/pg_1").name).toBe("publish");
    expect(parseHash("#/share/pg_1").name).toBe("share");
    expect(parseHash("#/template-from/pg_1").name).toBe("astemplate");
    expect(parseHash("#/me").name).toBe("me");
    expect(parseHash("#/p/priya").params.slug).toBe("priya");
    expect(parseHash("#/nope/nope").name).toBe("notfound");
  });
});

import { fitRect, moveRect, resizeCorner, roundRatio } from "../src/lib/crop";
import { AssetRefSchema } from "@madeforyou/schema";
import { shape } from "../../../packages/renderer/src/util";

describe("crop geometry", () => {
  it("fits the biggest shape inside the photo, centred", () => {
    expect(fitRect(400, 300, 1)).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    expect(fitRect(200, 400, 1)).toEqual({ x: 0, y: 100, w: 200, h: 200 });
    expect(fitRect(400, 300, null)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });
  it("never moves outside the photo", () => {
    const r = moveRect({ x: 10, y: 10, w: 100, h: 100 }, 999, -999, 400, 300);
    expect(r).toEqual({ x: 300, y: 0, w: 100, h: 100 });
  });
  it("keeps the opposite corner fixed and the shape when resizing", () => {
    const r = resizeCorner({ x: 100, y: 100, w: 100, h: 100 }, "se", 260, 250, 1, 400, 300);
    expect(r.x).toBe(100);
    expect(r.y).toBe(100);
    expect(r.w).toBeCloseTo(r.h);
    expect(r.x + r.w).toBeLessThanOrEqual(400);
    expect(r.y + r.h).toBeLessThanOrEqual(300);
  });
  it("resizes from the top-left without leaving the photo", () => {
    const r = resizeCorner({ x: 100, y: 100, w: 100, h: 100 }, "nw", -50, -50, null, 400, 300);
    expect(r).toEqual({ x: 0, y: 0, w: 200, h: 200 });
  });
  it("keeps a minimum size", () => {
    const r = resizeCorner({ x: 100, y: 100, w: 100, h: 100 }, "se", 101, 101, null, 400, 300);
    expect(r.w).toBeGreaterThanOrEqual(48);
  });
  it("stores the crop shape and the page uses it", () => {
    expect(AssetRefSchema.parse({ asset: "ast_abcd1234", ratio: roundRatio(0.8) }).ratio).toBe(0.8);
    expect(AssetRefSchema.safeParse({ asset: "ast_abcd1234", ratio: 99 }).success).toBe(false);
    expect(shape({ ratio: 0.8 })).toEqual({ aspectRatio: "0.8" });
    expect(shape({})).toBeUndefined();
  });
});

import { frameRatio } from "@madeforyou/ui";
describe("cover frame shape", () => {
  it("matches the theme's frame", () => {
    expect(frameRatio("rose-garden")).toBeGreaterThan(0.5);
    for (const p of ["rose-garden", "marigold-sun", "does-not-exist"]) expect([0.75, 0.8, 1]).toContain(frameRatio(p));
  });
});
