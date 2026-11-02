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

import { isSafeLink, normalizeLink, parseVideoUrl, defaultValue, placeholderValue } from "../src";

describe("links and video are safe by construction", () => {
  it("accepts web, email and phone links only", () => {
    for (const ok of ["", "https://wa.me/919876543210", "http://example.com", "mailto:a@b.co", "tel:+919876543210"]) expect(isSafeLink(ok)).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>", "vbscript:x", "file:///etc/passwd", "not a link", "//evil.com"]) expect(isSafeLink(bad)).toBe(false);
  });
  it("turns what people type into a real link", () => {
    expect(normalizeLink("9876543210")).toBe("tel:+919876543210");
    expect(normalizeLink("+91 98765-43210")).toBe("tel:+919876543210");
    expect(normalizeLink("me@example.com")).toBe("mailto:me@example.com");
    expect(normalizeLink("www.example.com/page")).toBe("https://www.example.com/page");
    expect(normalizeLink("https://wa.me/91123")).toBe("https://wa.me/91123");
    expect(normalizeLink("  ")).toBe("");
    expect(isSafeLink(normalizeLink("javascript:alert(1)"))).toBe(false);
  });
  it("accepts YouTube and Vimeo links, as provider + id, and nothing else", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=5")?.provider).toBe("youtube");
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://player.vimeo.com/video/123456789")?.provider).toBe("vimeo");
    expect(parseVideoUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
  });
  it("rejects an unsafe link or video stored in a page", () => {
    const b = createBlock("buttons");
    b.fields.items = [{ label: "Click", url: "javascript:alert(1)" }];
    expect(validateContent({ ...starterSkeleton(), blocks: [b] }).ok).toBe(false);
    b.fields.items = [{ label: "WhatsApp", url: "https://wa.me/919876543210" }];
    expect(validateContent({ ...starterSkeleton(), blocks: [b] }).ok).toBe(true);
    const v = createBlock("video");
    v.fields.video = { provider: "youtube", id: "x" };
    expect(validateContent({ ...starterSkeleton(), blocks: [v] }).ok).toBe(false);
    v.fields.video = { provider: "vimeo", id: "123456789" };
    expect(validateContent({ ...starterSkeleton(), blocks: [v] }).ok).toBe(true);
  });
  it("has defaults for the new kinds", () => {
    expect(defaultValue({ kind: "url", max: 10 })).toBe("");
    expect(placeholderValue({ kind: "embed" })).toBeNull();
  });
});

describe("the full block set", () => {
  it("has every block, each valid with its placeholders", () => {
    expect(Object.keys(registry).length).toBeGreaterThanOrEqual(21);
    const blocks = Object.keys(registry).map((t) => createBlock(t));
    expect(validateContent({ ...starterSkeleton(), blocks }).ok).toBe(true);
  });
  it("strips personal content from every block, including list items", () => {
    const blocks = Object.keys(registry).map((t) => {
      const b = createBlock(t);
      for (const [name, def] of Object.entries(registry[t]!.fields)) {
        if (def.kind === "text" && def.personal) b.fields[name] = "SECRET-VALUE";
      }
      return b;
    });
    const stripped = stripPersonal({ ...starterSkeleton(), blocks });
    expect(JSON.stringify(stripped.content)).not.toContain("SECRET-VALUE");
  });
});

import { cleanSubmission, parseGeo } from "../src";

describe("places", () => {
  it("reads coordinates and map links, and refuses what it cannot read", () => {
    expect(parseGeo("19.0760, 72.8777")).toEqual({ lat: 19.076, lng: 72.8777 });
    expect(parseGeo("19.076 72.8777")).toEqual({ lat: 19.076, lng: 72.8777 });
    expect(parseGeo("https://www.openstreetmap.org/?mlat=19.0760&mlon=72.8777#map=16/19.0760/72.8777")).toEqual({ lat: 19.076, lng: 72.8777 });
    expect(parseGeo("https://www.openstreetmap.org/#map=16/19.0176/72.8562")).toEqual({ lat: 19.0176, lng: 72.8562 });
    expect(parseGeo("https://www.google.com/maps/place/Gateway+of+India/@18.9219841,72.8346543,17z/data=x")).toEqual({ lat: 18.92198, lng: 72.83465 });
    expect(parseGeo("https://www.google.com/maps?q=19.076,72.8777")).toEqual({ lat: 19.076, lng: 72.8777 });
    expect(parseGeo("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(parseGeo("95, 200")).toBeNull();
    expect(parseGeo("hello")).toBeNull();
    expect(parseGeo("")).toBeNull();
  });
});

describe("guest messages", () => {
  it("tidies and limits what guests send", () => {
    expect(cleanSubmission("wish", { name: "  Meera ", message: "Happy birthday!\u0000" })).toEqual({ ok: true, payload: { name: "Meera", message: "Happy birthday!" } });
    expect(cleanSubmission("wish", { name: "", message: "x" })).toMatchObject({ ok: false });
    expect(cleanSubmission("wish", { name: "A", message: "x".repeat(900) })).toMatchObject({ ok: true, payload: { message: "x".repeat(500) } });
    expect(cleanSubmission("reply", { message: "Thank you" })).toEqual({ ok: true, payload: { message: "Thank you" } });
    expect(cleanSubmission("reply", { message: "  " })).toMatchObject({ ok: false });
    expect(cleanSubmission("wish", null)).toMatchObject({ ok: false });
  });
  it("RSVPs need a name and an answer, and a 'no' brings no guests", () => {
    expect(cleanSubmission("rsvp", { name: "Raj", response: "yes", guests: 3 })).toEqual({ ok: true, payload: { name: "Raj", response: "yes", guests: 3 } });
    expect(cleanSubmission("rsvp", { name: "Raj", response: "no", guests: 5 })).toMatchObject({ payload: { guests: 0 } });
    expect(cleanSubmission("rsvp", { name: "Raj", response: "yes", guests: 99 })).toMatchObject({ payload: { guests: 10 } });
    expect(cleanSubmission("rsvp", { name: "Raj", response: "perhaps" })).toMatchObject({ ok: false });
    expect(cleanSubmission("rsvp", { response: "yes" })).toMatchObject({ ok: false });
  });
});

describe("26 blocks", () => {
  it("the whole planned set exists and validates", () => {
    expect(Object.keys(registry)).toHaveLength(26);
    expect(validateContent({ ...starterSkeleton(), blocks: Object.keys(registry).map((t) => createBlock(t)) }).ok).toBe(true);
  });
  it("accepts a voice note and a place only in their exact shapes", () => {
    const v = createBlock("voiceNote");
    v.fields.audio = { asset: "ast_voice01", seconds: 42 };
    expect(validateContent({ ...starterSkeleton(), blocks: [v] }).ok).toBe(true);
    v.fields.audio = { asset: "ast_voice01", seconds: 600 };
    expect(validateContent({ ...starterSkeleton(), blocks: [v] }).ok).toBe(false);
    const m = createBlock("map");
    m.fields.location = { lat: 19.07, lng: 72.87 };
    expect(validateContent({ ...starterSkeleton(), blocks: [m] }).ok).toBe(true);
    m.fields.location = { lat: 190, lng: 0 };
    expect(validateContent({ ...starterSkeleton(), blocks: [m] }).ok).toBe(false);
  });
});
