import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { getTemplate } from "@madeforyou/templates";
import { makeClient, makeEnv } from "../src/testing";

const H = 3_600_000;
const D = 24 * H;
const ADMIN = { "x-admin-token": "admin-token-123" };
let env: ReturnType<typeof makeEnv>;
let call: ReturnType<typeof makeClient>;
let t = 1_790_000_000_000;
let brevo: { status: number }[] = [];
let sent: any[] = [];

const fetchStub = (async (url: string, init: RequestInit) => {
  if (String(url).startsWith("https://api.brevo.com/")) {
    const next = brevo.shift();
    if (next && next.status >= 300) return new Response(JSON.stringify({ message: "no" }), { status: next.status });
    sent.push(JSON.parse(String(init.body)));
    return new Response("{}", { status: 201 });
  }
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

const boot = (extra: Record<string, string> = {}) => {
  env = makeEnv(extra);
  call = makeClient(env, { now: () => t, fetch: fetchStub });
};
beforeEach(() => { t = 1_790_000_000_000; brevo = []; sent = []; boot(); });

const webp = () => { const b = new Uint8Array(64); b.set([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b; };
function page(cover?: string): Content {
  let c = starterSkeleton();
  const [hero, text, , sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", "Hello Priya.");
  c = setField(c, sig!.id, "name", "Abhi");
  c = { ...c, blocks: c.blocks.filter((b) => b.type !== "gallery") };
  if (cover) c.blocks[0]!.fields.cover = { asset: cover };
  return c;
}
const rows = async (sql: string, ...a: unknown[]) => ((await env.DB.prepare(sql).bind(...a).all()) as any).results as any[];

describe("request bodies are limited by the bytes that really arrive", () => {
  const big = () => JSON.stringify({ title: "x", content: page(), pad: "y".repeat(500_000) });

  it("refuses a big JSON body that carries no Content-Length header", async () => {
    const r = await call("PUT", "/pages/pg_hard0001", { user: "abhi", body: big(), headers: { "content-type": "application/json" } });
    expect(r.status).toBe(413);
  });
  it("refuses one whose header lies about how small it is", async () => {
    const r = await call("PUT", "/pages/pg_hard0001", { user: "abhi", body: big(), headers: { "content-type": "application/json", "content-length": "20" } });
    expect(r.status).toBe(413);
  });
  it("still accepts an ordinary page, and bad JSON is a plain 400", async () => {
    expect((await call("PUT", "/pages/pg_hard0001", { user: "abhi", json: { title: "ok", content: page() } })).status).toBe(200);
    expect((await call("PUT", "/pages/pg_hard0002", { user: "abhi", body: "{not json", headers: { "content-type": "application/json" } })).status).toBe(400);
    expect((await call("PUT", "/pages/pg_hard0002", { user: "abhi", body: "", headers: { "content-type": "application/json" } })).status).toBe(400);
  });
  it("refuses an oversized photo even when no size is declared, and stores nothing", async () => {
    const huge = new Uint8Array(LIMITS.assetBytes + 10);
    huge.set(webp());
    const r = await call("PUT", "/assets/ast_huge0001", { user: "abhi", body: huge, headers: { "content-type": "image/webp" } });
    expect(r.status).toBe(413);
    expect(await rows("SELECT id FROM assets")).toHaveLength(0);
    expect((await call("PUT", "/assets/ast_empty001", { user: "abhi", body: new Uint8Array(0), headers: { "content-type": "image/webp" } })).status).toBe(413);
    expect((await call("PUT", "/assets/ast_fine0001", { user: "abhi", body: webp(), headers: { "content-type": "image/webp" } })).status).toBe(200);
  });
});

describe("a visitor's photo pass follows the page's CURRENT state", () => {
  const setup = async (publishBody: object = {}) => {
    await call("PUT", "/assets/ast_cover001", { user: "abhi", body: webp(), headers: { "content-type": "image/webp" } });
    await call("PUT", "/pages/pg_hard0001", { user: "abhi", json: { title: "t", content: page("ast_cover001") } });
    expect((await call("POST", "/pages/pg_hard0001/publish", { user: "abhi", json: { slug: "priya", ...publishBody } })).status).toBe(200);
    return (await call("GET", "/p/priya")).json.assetToken as string;
  };
  const photo = (token: string) => call("GET", `/a/ast_cover001?t=${encodeURIComponent(token)}`);

  it("works while the page is open", async () => {
    expect((await photo(await setup())).status).toBe(200);
  });
  it("stops when the page ends, even though the pass has hours left", async () => {
    const token = await setup({ expiresAt: new Date(t + 3 * H).toISOString() });
    expect((await photo(token)).status).toBe(200);
    t += 4 * H;
    expect((await photo(token)).status).toBe(404);
  });
  it("stops when the owner locks the page again, or makes it private, and resumes when it is open again", async () => {
    const token = await setup();
    await call("POST", "/pages/pg_hard0001/publish", { user: "abhi", json: { slug: "priya", unlockAt: new Date(t + 2 * D).toISOString() } });
    expect((await photo(token)).status).toBe(404);
    await call("POST", "/pages/pg_hard0001/publish", { user: "abhi", json: { slug: "priya", visibility: "private" } });
    expect((await photo(token)).status).toBe(404);
    await call("POST", "/pages/pg_hard0001/publish", { user: "abhi", json: { slug: "priya", unlockAt: null, visibility: "unlisted" } });
    expect((await photo(token)).status).toBe(200);
  });
  it("the owner's own pass is unaffected", async () => {
    await setup({ expiresAt: new Date(t + H).toISOString() });
    const mine = (await call("GET", "/me/token", { user: "abhi" })).json.token as string;
    t += 2 * H;
    expect((await photo(mine)).status).toBe(200);
  });
});

describe("templates", () => {
  const tmpl = (id: string) => { const base = getTemplate("thank-you-simple")!; return { meta: { ...base.meta, id, visibility: "public" }, content: base.content }; };

  it("only the owner can change a template", async () => {
    expect((await call("PUT", "/templates/shared-id", { user: "abhi", json: { template: tmpl("shared-id") } })).status).toBe(200);
    expect((await call("PUT", "/templates/shared-id", { user: "mallory", json: { template: tmpl("shared-id") } })).status).toBe(409);
    await call("DELETE", "/templates/shared-id", { user: "mallory" }); // quietly does nothing: it is not theirs
    expect((await call("GET", "/me/templates", { user: "abhi" })).json.templates).toHaveLength(1);
  });
  it("saving again never undoes a rejection", async () => {
    for (const n of ["ok-one", "ok-two", "ok-three"]) {
      await call("PUT", `/templates/${n}`, { user: "abhi", json: { template: tmpl(n) } });
      await call("POST", `/admin/templates/${n}/approve`, { headers: ADMIN });
    }
    await call("PUT", "/templates/bad-one", { user: "abhi", json: { template: tmpl("bad-one") } });
    await call("POST", "/admin/templates/bad-one/reject", { headers: ADMIN });
    // this owner has 3 approved templates, which would normally approve a new one on the spot
    const again = await call("PUT", "/templates/bad-one", { user: "abhi", json: { template: tmpl("bad-one") } });
    expect(again.status).toBe(200);
    expect(again.json.status).toBe("rejected");
    expect((await call("GET", "/templates")).json.templates.map((x: any) => x.meta.id)).not.toContain("bad-one");
  });
});

describe("email is never sent twice", () => {
  beforeEach(() => boot({ BREVO_API_KEY: "k", MAIL_FROM: "owner@example.com", CRON_SECRET: "cron-1" }));
  const tick = () => call("POST", "/cron/tick", { headers: { authorization: "Bearer cron-1" } });
  const queue = async () => {
    await call("PUT", "/pages/pg_hard0001", { user: "abhi", json: { title: "t", content: page() } });
    await call("POST", "/pages/pg_hard0001/publish", { user: "abhi", json: { slug: "priya" } });
    const r = await call("POST", "/pages/pg_hard0001/deliveries", { user: "abhi", json: { toEmail: "friend@example.com", fromName: "Abhi", sendAt: new Date(t + H).toISOString() } });
    return r.json.delivery.id as string;
  };

  it("if the server stopped after the email left, the next run does not send a second copy", async () => {
    const id = await queue();
    // what a crash leaves behind: marked as sending a long time ago, with the send already written in the log
    await env.DB.prepare("UPDATE deliveries SET status = 'sending', claimed_at = ? WHERE id = ?").bind(new Date(t).toISOString(), id).run();
    await env.DB.prepare("INSERT INTO mail_log (key, at, sent) VALUES (?, ?, 1)").bind(`dl:${id}`, new Date(t).toISOString()).run();
    t += 2 * H;
    await tick();
    expect(sent).toHaveLength(0);
    const row = (await rows("SELECT status, error FROM deliveries WHERE id = ?", id))[0];
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/cannot tell if it arrived/);
  });
  it("a failed send leaves no mark behind, so it can be tried again", async () => {
    const id = await queue();
    brevo = [{ status: 503 }];
    t += 2 * H;
    await tick();
    expect(sent).toHaveLength(0);
    expect(await rows("SELECT key FROM mail_log WHERE key = ?", `dl:${id}`)).toHaveLength(0);
    await tick();
    expect(sent).toHaveLength(1);
    expect((await rows("SELECT status FROM deliveries WHERE id = ?", id))[0].status).toBe("sent");
    t += H;
    await tick();
    expect(sent).toHaveLength(1);
  });
  it("two runs at the same moment send one email", async () => {
    await queue();
    t += 2 * H;
    await Promise.all([tick(), tick(), tick()]);
    expect(sent).toHaveLength(1);
  });
});

describe("headers and housekeeping", () => {
  it("allows every method the website uses when another origin is set", async () => {
    boot({ ALLOWED_ORIGIN: "https://madeforyou-9pj.pages.dev" });
    const app = (await import("../src")).createApp();
    const res = await app.request("/api/submissions/sb_x", { method: "OPTIONS", headers: { origin: "https://madeforyou-9pj.pages.dev", "access-control-request-method": "PATCH", "access-control-request-headers": "authorization,content-type" } }, env);
    expect(res.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://madeforyou-9pj.pages.dev");
    const other = await app.request("/api/submissions/sb_x", { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "PATCH" } }, env);
    expect(other.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
  });
  it("the stop-emails page has strict rules of its own", async () => {
    const r = await call("GET", "/mail/unsub?t=nonsense");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("the scheduler clears visitor-limit counters older than a day", async () => {
    boot({ CRON_SECRET: "cron-1" });
    await env.DB.prepare("INSERT INTO throttle (key, at) VALUES ('old', ?), ('new', ?)").bind(t - 2 * D, t - H).run();
    await call("POST", "/cron/tick", { headers: { authorization: "Bearer cron-1" } });
    expect((await rows("SELECT key FROM throttle")).map((x) => x.key)).toEqual(["new"]);
  });
});
