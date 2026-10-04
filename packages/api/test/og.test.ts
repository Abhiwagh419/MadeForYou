import { describe, expect, it } from "vitest";
import { setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { META_MARKER, injectMeta, renderPageShell } from "../src";
import { makeClient, makeEnv } from "../src/testing";

const SHELL = `<html><head><title>MadeForYou</title>${META_MARKER}</head><body></body></html>`;

function ready(): Content {
  let c = starterSkeleton();
  const [hero, text, gallery, sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday");
  c = setField(c, hero!.id, "cover", { asset: "ast_cover1", alt: "Priya" });
  c = setField(c, text!.id, "body", "hello");
  c = setField(c, gallery!.id, "items", [{ image: { asset: "ast_cover1" } }]);
  return setField(c, sig!.id, "name", "Abhi");
}

describe("link previews", () => {
  it("escapes everything it injects", () => {
    const html = injectMeta(SHELL, { title: `"><script>alert(1)</script>`, description: "a & b", image: "https://x/y.png", url: "https://x/p/a" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain(META_MARKER);
  });

  async function setup(publishBody: object = {}) {
    const env = makeEnv();
    const call = makeClient(env);
    await call("PUT", "/pages/pg_abcdef1", { user: "abhi", json: { title: "For Priya", content: ready() } });
    await call("PUT", "/assets/ast_cover1", { user: "abhi", body: new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0]), headers: { "content-type": "image/webp" } });
    await call("PUT", "/pages/pg_abcdef1", { user: "abhi", json: { title: "For Priya", content: ready() } });
    await call("POST", "/pages/pg_abcdef1/publish", { user: "abhi", json: { slug: "priya", ...publishBody } });
    return env;
  }

  it("an open page shows its name and cover", async () => {
    const env = await setup();
    const html = await renderPageShell(env, SHELL, "https://made.example", "priya");
    expect(html).toContain('<meta property="og:title" content="For Priya">');
    expect(html).toContain("A page made just for Priya");
    expect(html).toContain("https://made.example/api/a/ast_cover1?t=");
  });
  it.each([
    ["locked", { unlockAt: new Date(Date.now() + 86_400_000).toISOString() }],
    ["password protected", { password: "secret-pw" }],
    ["private", { visibility: "private" }],
  ])("a %s page reveals nothing in its preview", async (_name, body) => {
    const env = await setup(body);
    const html = await renderPageShell(env, SHELL, "https://made.example", "priya");
    expect(html).toContain("Something is waiting for you");
    expect(html).not.toContain("Priya");
    expect(html).not.toContain("ast_cover1");
    expect(html).toContain("/og-default.png");
  });
  it("an unknown or malformed link gets the generic card", async () => {
    const env = makeEnv();
    for (const slug of ["nope", "../../etc", "<script>"]) {
      const html = await renderPageShell(env, SHELL, "https://made.example", slug);
      expect(html).toContain("Something is waiting for you");
      expect(html).not.toContain("<script>");
    }
  });
});
