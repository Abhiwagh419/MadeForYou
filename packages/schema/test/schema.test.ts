import { describe, expect, it } from "vitest";
import {
  checkPublishable, createBlock, guidedQuestions, registry, starterSkeleton,
  stripPersonal, validateContent, MAX_BLOCKS, type Content,
} from "../src";

const empty = (): Content => ({ ...starterSkeleton(), blocks: [] });

describe("registry + validation", () => {
  it("every registered block creates valid content", () => {
    const content = { ...empty(), blocks: Object.keys(registry).map((t) => createBlock(t)) };
    const r = validateContent(content);
    expect(r.ok).toBe(true);
  });

  it("starter skeleton is Hero, Text, Gallery, Signature and valid", () => {
    const s = starterSkeleton();
    expect(s.blocks.map((b) => b.type)).toEqual(["hero", "text", "gallery", "signature"]);
    expect(validateContent(s).ok).toBe(true);
  });

  it("rejects unknown block types", () => {
    const c = starterSkeleton();
    (c.blocks[0] as { type: string }).type = "script";
    const r = validateContent(c);
    expect(r.ok).toBe(false);
  });

  it("drops unknown fields", () => {
    const c = starterSkeleton();
    c.blocks[0]!.fields.evil = "<script>alert(1)</script>";
    const r = validateContent(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content.blocks[0]!.fields).not.toHaveProperty("evil");
  });

  it("rejects too many blocks, duplicate ids and oversized text", () => {
    const many = { ...empty(), blocks: Array.from({ length: MAX_BLOCKS + 1 }, () => createBlock("text")) };
    expect(validateContent(many).ok).toBe(false);

    const a = createBlock("text", "blk_same");
    const dup = { ...empty(), blocks: [a, { ...a }] };
    expect(validateContent(dup).ok).toBe(false);

    const big = createBlock("text");
    big.fields.body = "x".repeat(2001);
    expect(validateContent({ ...empty(), blocks: [big] }).ok).toBe(false);
  });

  it("only accepts asset references for images, never URLs", () => {
    const hero = createBlock("hero");
    hero.fields.cover = "https://evil.example/x.png";
    expect(validateContent({ ...empty(), blocks: [hero] }).ok).toBe(false);
    hero.fields.cover = { asset: "ast_abc123", alt: "Us at the beach" };
    expect(validateContent({ ...empty(), blocks: [hero] }).ok).toBe(true);
  });

  it("stores embeds as provider + id, rejecting raw URLs", () => {
    const base = empty();
    base.settings.music = { provider: "youtube", id: "https://youtube.com/watch?v=abc" } as never;
    expect(validateContent(base).ok).toBe(false);
    base.settings.music = { provider: "youtube", id: "dQw4w9WgXcQ" };
    expect(validateContent(base).ok).toBe(true);
  });

  it("only allows translating text fields", () => {
    const hero = createBlock("hero");
    hero.i18n = { hi: { recipient: "माँ" } };
    expect(validateContent({ ...empty(), blocks: [hero] }).ok).toBe(true);
    hero.i18n = { hi: { layout: "split" } };
    expect(validateContent({ ...empty(), blocks: [hero] }).ok).toBe(false);
  });
});

function filledPage(): Content {
  const c = starterSkeleton();
  const [hero, text, gallery, signature] = c.blocks as [any, any, any, any];
  hero.fields.recipient = "Priya";
  hero.fields.title = "Happy Birthday Priya";
  hero.fields.cover = { asset: "ast_secret1", alt: "Priya at Marine Drive" };
  hero.i18n = { hi: { recipient: "प्रिया" } };
  text.fields.body = "Priya, you were there at 3am when I needed you.";
  gallery.fields.items = [{ image: { asset: "ast_secret2", alt: "Us" }, caption: "Lonavala with Priya" }];
  signature.fields.name = "Abhi";
  for (const b of c.blocks) b.ph = [];
  c.settings.music = { provider: "spotify", id: "4uLU6hMCjMI75M1A2tKUQC" };
  return c;
}

describe("stripPersonal (share as template)", () => {
  it("leaves no personal content behind", () => {
    const { content, report } = stripPersonal(filledPage());
    const json = JSON.stringify(content);
    for (const secret of ["Priya", "प्रिया", "ast_secret1", "ast_secret2", "Lonavala", "3am", "Abhi", "4uLU6hMCjMI75M1A2tKUQC"]) {
      expect(json).not.toContain(secret);
    }
    expect(report.some((r) => r.field === "music")).toBe(true);
    expect(validateContent(content).ok).toBe(true);
  });

  it("marks stripped fields as placeholders", () => {
    const { content } = stripPersonal(filledPage());
    expect(content.blocks[0]!.ph).toEqual(expect.arrayContaining(["recipient", "title", "cover"]));
  });

  it("keeps fields the author explicitly keeps, and nothing else", () => {
    const page = filledPage();
    const heroId = page.blocks[0]!.id;
    page.blocks[0]!.fields.title = "Happy Birthday";
    const { content, report } = stripPersonal(page, { keep: { [heroId]: ["title"] } });
    expect(content.blocks[0]!.fields.title).toBe("Happy Birthday");
    expect(content.blocks[0]!.fields.recipient).not.toBe("Priya");
    expect(report.filter((r) => r.action === "kept")).toHaveLength(1);
  });

  it("does not mutate the original page", () => {
    const page = filledPage();
    stripPersonal(page);
    expect(page.blocks[0]!.fields.recipient).toBe("Priya");
  });
});

describe("guided mode", () => {
  it("asks essential questions first, then richer ones, only for unfilled fields", () => {
    const qs = guidedQuestions(starterSkeleton());
    const firstRicher = qs.findIndex((q) => q.tier === "richer");
    expect(qs.slice(0, firstRicher).every((q) => q.tier === "essential")).toBe(true);
    expect(qs[0]!.prompt).toBe("Who is this made for?");
    expect(guidedQuestions(filledPage())).toHaveLength(0);
  });

  it("skips hidden blocks", () => {
    const c = starterSkeleton();
    c.blocks.forEach((b) => (b.visible = false));
    expect(guidedQuestions(c)).toHaveLength(0);
  });
});

describe("publish check", () => {
  it("blocks publishing a fresh skeleton and names what is missing", () => {
    const r = checkPublishable(starterSkeleton());
    expect(r.canPublish).toBe(false);
    expect(r.issues.some((i) => i.code === "required-missing" && i.field === "recipient")).toBe(true);
  });

  it("allows a filled page, warning about missing alt text", () => {
    const page = filledPage();
    (page.blocks[2]!.fields.items as any[])[0].image = { asset: "ast_secret2" };
    const r = checkPublishable(page);
    expect(r.canPublish).toBe(true);
    expect(r.issues.some((i) => i.code === "image-missing-alt")).toBe(true);
  });

  it("ignores hidden blocks", () => {
    const c = starterSkeleton();
    c.blocks.forEach((b) => (b.visible = false));
    expect(checkPublishable(c).issues).toHaveLength(0);
  });
});

import { personalNames, setField } from "../src";

describe("setField (editing keeps translations honest)", () => {
  const withHindi = (): Content => {
    const c = starterSkeleton();
    c.settings.languages = { default: "en", available: ["en", "hi"] };
    c.blocks[0]!.i18n = { hi: { recipient: "माँ", title: "शुभकामनाएँ" } };
    return c;
  };

  it("filling the default language clears the placeholder and drops stale translations of that field only", () => {
    const c = withHindi();
    const id = c.blocks[0]!.id;
    const next = setField(c, id, "recipient", "Priya");
    const hero = next.blocks[0]!;
    expect(hero.fields.recipient).toBe("Priya");
    expect(hero.ph).not.toContain("recipient");
    expect(hero.i18n?.hi).toEqual({ title: "शुभकामनाएँ" });
  });

  it("removes the i18n object entirely when nothing is left", () => {
    const c = withHindi();
    c.blocks[0]!.i18n = { hi: { recipient: "माँ" } };
    expect(setField(c, c.blocks[0]!.id, "recipient", "Priya").blocks[0]!.i18n).toBeUndefined();
  });

  it("writing another language stores a translation and keeps the default text", () => {
    const c = withHindi();
    const id = c.blocks[0]!.id;
    const next = setField(c, id, "subtitle", "प्यार के साथ", "hi");
    expect(next.blocks[0]!.i18n?.hi?.subtitle).toBe("प्यार के साथ");
    expect(next.blocks[0]!.fields.subtitle).toBe(c.blocks[0]!.fields.subtitle);
    expect(next.blocks[0]!.ph).toContain("subtitle");
  });

  it("refuses to translate non-text fields, unknown fields and unknown blocks", () => {
    const c = withHindi();
    const id = c.blocks[0]!.id;
    expect(() => setField(c, id, "layout", "split", "hi")).toThrow();
    expect(() => setField(c, id, "nope", "x")).toThrow();
    expect(() => setField(c, "blk_missing", "title", "x")).toThrow();
  });

  it("does not mutate the original and the result still validates", () => {
    const c = withHindi();
    const before = JSON.stringify(c);
    const next = setField(c, c.blocks[0]!.id, "recipient", "Priya");
    expect(JSON.stringify(c)).toBe(before);
    expect(validateContent(next).ok).toBe(true);
  });
});

describe("motion settings", () => {
  it("accepts the zoom entrance and the tap effects, and rejects anything else", () => {
    const c = starterSkeleton();
    c.blocks[0]!.style.anim = "zoom";
    c.settings.tap = "sparkles";
    expect(validateContent(c).ok).toBe(true);
    (c.settings as { tap: string }).tap = "fireworks";
    expect(validateContent(c).ok).toBe(false);
  });

  it("defaults to no tap effect and no entrance animation", () => {
    const c = starterSkeleton();
    expect(c.settings.tap).toBe("none");
    expect(c.blocks.every((b) => b.style.anim === "none")).toBe(true);
  });

  it("keeps the tap effect when a page is shared as a template (it is not personal)", () => {
    const c = starterSkeleton();
    c.settings.tap = "hearts";
    expect(stripPersonal(c).content.settings.tap).toBe("hearts");
  });
});

describe("personalNames", () => {
  it("returns typed names but not sample text or common words", () => {
    expect(personalNames(starterSkeleton())).toEqual([]);
    const c = filledPage();
    const names = personalNames(c);
    expect(names).toEqual(expect.arrayContaining(["priya", "abhi"]));
    expect(names).not.toContain("dear");
  });
});

import { assetIds, gateState, slugStatus } from "../src";

describe("shared access rules", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  it("orders the gates: ended, locked, password, open", () => {
    expect(gateState({ hasPassword: false }, now)).toBe("open");
    expect(gateState({ hasPassword: true }, now)).toBe("password");
    expect(gateState({ hasPassword: true, unlockAt: "2026-12-01T00:00:00Z" }, now)).toBe("locked");
    expect(gateState({ hasPassword: true, unlockAt: "2026-01-01T00:00:00Z" }, now)).toBe("password");
    expect(gateState({ hasPassword: false, unlockAt: "2026-12-01T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z" }, now)).toBe("ended");
  });
  it("finds every asset a page uses, once", () => {
    const c = filledPage();
    expect(assetIds(c).sort()).toEqual(["ast_secret1", "ast_secret2"]);
  });
  it("validates links", () => {
    expect(slugStatus("priya-2026", () => false)).toBe("ok");
    expect(slugStatus("api", () => false)).toBe("reserved");
    expect(slugStatus("A", () => false)).toBe("short");
    expect(slugStatus("taken-one", (s) => s === "taken-one")).toBe("taken");
  });
});
