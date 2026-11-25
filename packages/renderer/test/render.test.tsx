import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createBlock, starterSkeleton, type Content } from "@madeforyou/schema";
import { templates } from "@madeforyou/templates";
import { PageRenderer, parseTarget, splitRemaining } from "../src";

const html = (content: Content, props: Partial<Parameters<typeof PageRenderer>[0]> = {}) =>
  renderToStaticMarkup(<PageRenderer content={content} skipOpening {...props} />);

const plain = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("PageRenderer", () => {
  it("renders every launch template", () => {
    for (const t of templates) {
      const out = html(t.content);
      expect(out).toContain("mfy-page");
      expect(out).toContain("Made with MadeForYou");
    }
  });

  it("shows the opening screen first, and holds the page back until it is opened", () => {
    const t = templates.find((x) => x.meta.id === "mothers-day-letter")!;
    const out = html(t.content, { skipOpening: false });
    expect(out).toContain("Tap to open");
    expect(plain(out)).not.toContain("Happy Mother's Day");
  });

  it("switches language and falls back to the default", () => {
    const t = templates.find((x) => x.meta.id === "mothers-day-letter")!;
    expect(plain(html(t.content, { lang: "hi" }))).toContain("मातृ दिवस की शुभकामनाएँ");
    expect(plain(html(t.content, { lang: "mr" }))).toContain("Happy Mother's Day");
  });

  it("greys out placeholder fields", () => {
    const t = templates.find((x) => x.meta.id === "mothers-day-letter")!;
    expect(html(t.content)).toContain("mfy-ph");
  });

  it("escapes user text instead of rendering it as HTML", () => {
    const c = starterSkeleton();
    c.blocks[0]!.fields.title = "<script>alert(1)</script>";
    const out = html(c);
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("never emits raw HTML injection points", () => {
    for (const t of templates) expect(html(t.content)).not.toContain("dangerouslySetInnerHTML");
  });

  it("resolves asset references through the host, not from the data", () => {
    const c = starterSkeleton();
    c.blocks[0]!.fields.cover = { asset: "ast_cover1", alt: "Us" };
    c.blocks[0]!.ph = [];
    const out = html(c, { resolveAsset: (r) => `https://cdn.example/${r.asset}.webp` });
    expect(out).toContain('src="https://cdn.example/ast_cover1.webp"');
    expect(out).toContain('alt="Us"');
  });

  it("builds music embeds from provider + id only", () => {
    const c = starterSkeleton();
    c.settings.music = { provider: "youtube", id: "dQw4w9WgXcQ" };
    const out = html(c);
    expect(out).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(out).toContain("sandbox=");
  });

  it("hides blocks marked not visible", () => {
    const c = starterSkeleton();
    const extra = createBlock("text");
    extra.fields.heading = "Secret heading";
    extra.visible = false;
    c.blocks.push(extra);
    expect(html(c)).not.toContain("Secret heading");
  });
});

describe("countdown helpers", () => {
  it("treats a date-only target as midnight IST", () => {
    expect(parseTarget("2026-12-25")).toBe(Date.parse("2026-12-25T00:00:00+05:30"));
    expect(parseTarget("")).toBeNull();
    expect(parseTarget("not a date")).toBeNull();
  });
  it("splits remaining time", () => {
    expect(splitRemaining(90_061_000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(splitRemaining(-5)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });
});

import { setField } from "@madeforyou/schema";
import { THEMES, themeToCssVars } from "@madeforyou/ui";

describe("editing and translations", () => {
  const mothersDay = () => structuredClone(templates.find((x) => x.meta.id === "mothers-day-letter")!.content);

  it("a name the user typed is not hidden by the template's Hindi version", () => {
    const c = mothersDay();
    const next = setField(c, c.blocks[0]!.id, "recipient", "Priya");
    const out = html(next, { lang: "hi" });
    expect(plain(out)).toContain("Priya");
    expect(out).not.toContain("माँ</p>");
    expect(plain(out)).toContain("मातृ दिवस की शुभकामनाएँ");
  });
});

describe("themes are whole looks", () => {
  it("differ in type, frame shape and corners, not just colour", () => {
    const vars = Object.keys(THEMES).map((k) => themeToCssVars(k));
    for (const key of ["--mfy-font-heading", "--mfy-frame-radius", "--mfy-radius", "--mfy-title-weight"]) {
      expect(new Set(vars.map((v) => v[key])).size).toBe(vars.length);
    }
  });

  it("applies the theme's variables to the page", () => {
    const t = templates.find((x) => x.meta.id === "birthday-countdown")!;
    const out = html(t.content);
    expect(out).toContain("--mfy-frame-radius:50%");
    expect(out).toContain("Rozha One");
  });
});

describe("dynamic layer", () => {
  const mothers = () => structuredClone(templates.find((x) => x.meta.id === "mothers-day-letter")!.content);

  it("splits the headline into indexed words so CSS can stagger them", () => {
    const out = html(mothers());
    expect(out).toContain('<span class="mfy-word" style="--i:0">Happy</span>');
    expect(out).toContain('<span class="mfy-word" style="--i:2">Day</span>');
    expect(plain(out)).toContain("Happy Mother's Day");
  });

  it("marks the page with its theme so each theme can have its own halo", () => {
    expect(html(mothers())).toContain('data-theme="rose-garden"');
  });

  it("marks blocks that reveal on scroll, and hides nothing without scripts", () => {
    const out = html(mothers());
    expect(out).toContain('data-reveal="fade-up"');
    expect(out).toContain('data-in="false"');
    expect(out).not.toContain("mfy-armed");
  });

  it("indexes letter paragraphs for the line-by-line unfold", () => {
    expect(html(mothers())).toMatch(/<p style="--i:1">/);
  });

  it("renders the tap layer only when a tap effect is chosen", () => {
    const c = mothers();
    expect(c.settings.tap).toBe("hearts");
    expect(html(c)).toContain("mfy-taps");
    c.settings.tap = "none";
    expect(html(c)).not.toContain("mfy-taps");
  });
});
