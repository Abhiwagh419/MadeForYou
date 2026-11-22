import { describe, expect, it } from "vitest";
import { makeEnv } from "@madeforyou/api/testing";
import { onRequestGet } from "../functions/p/[slug]";

describe("shared pages", () => {
  it("ask search engines not to list them, whether or not the page exists", async () => {
    const env = { ...makeEnv(), ASSETS: { fetch: async () => new Response("<html><head><title>MadeForYou</title></head><body></body></html>") } };
    for (const slug of ["does-not-exist", "Another-One"]) {
      const res = await onRequestGet({ request: new Request(`https://example.com/p/${slug}`), env: env as never, params: { slug } });
      expect(res.status).toBe(200);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });
  it("the static rules cover invite links too", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const headers = readFileSync(join(process.cwd(), "public", "_headers"), "utf8"); // the tests run from apps/studio
    expect(headers).toMatch(/\/c\/\*\n\s+X-Robots-Tag: noindex/);
  });
});

describe("security headers on pages the server produces itself", () => {
  const html = "<html><head><title>MadeForYou</title></head><body></body></html>";
  const env = () => ({ ...makeEnv(), ASSETS: { fetch: async () => new Response(html) } });

  it("the shared page and the home page both send them (the static headers file does not reach Functions)", async () => {
    const shared = await onRequestGet({ request: new Request("https://example.com/p/x"), env: env() as never, params: { slug: "x" } });
    const { onRequestGet: home } = await import("../functions/index");
    const root = await home({ request: new Request("https://example.com/"), env: env() as never });
    for (const res of [shared, root]) {
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("permissions-policy")).toContain("camera=()");
      expect(res.headers.get("content-security-policy-report-only")).toContain("frame-ancestors 'none'");
    }
  });

  it("match the static headers file exactly, so the two lists cannot drift apart", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { HTML_SECURITY_HEADERS } = await import("@madeforyou/api");
    const file = readFileSync(join(process.cwd(), "public", "_headers"), "utf8");
    const block = file.split(/\n\s*\n/)[0]!; // the rules for /*
    const rule = (name: string) => new RegExp(`^\\s+${name}: (.*)$`, "im").exec(block)?.[1]?.trim();
    expect(rule("X-Content-Type-Options")).toBe(HTML_SECURITY_HEADERS["x-content-type-options"]);
    expect(rule("X-Frame-Options")).toBe(HTML_SECURITY_HEADERS["x-frame-options"]);
    expect(rule("Permissions-Policy")).toBe(HTML_SECURITY_HEADERS["permissions-policy"]);
    expect(rule("Content-Security-Policy-Report-Only")).toBe(HTML_SECURITY_HEADERS["content-security-policy-report-only"]);
  });
});

describe("addresses Clerk may send people to", () => {
  it("are not rewritten by a redirect rule (a rule to /index.html sent /sign-in to the home page)", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const file = join(process.cwd(), "public", "_redirects");
    const rules = existsSync(file) ? readFileSync(file, "utf8") : "";
    expect(rules).not.toMatch(/index\.html/);
  });
});
