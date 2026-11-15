import { beforeEach, describe, expect, it } from "vitest";
import { setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { makeClient, makeEnv, makeJwtSetup } from "../src/testing";

const D = 86_400_000;
let env: ReturnType<typeof makeEnv>;
let call: ReturnType<typeof makeClient>;
let t = 1_790_000_000_000;
let brevo: any[] = [];
let clerkDeletes: string[] = [];
let n = 0;
const fresh = () => ({ "cf-connecting-ip": `10.2.0.${++n}` });
const ADMIN = { "x-admin-token": "admin-token-123" };

const fetchStub = (async (url: string, init: RequestInit) => {
  const u = String(url);
  if (u.startsWith("https://api.brevo.com/")) { brevo.push(JSON.parse(String(init.body))); return new Response("{}", { status: 201 }); }
  if (u.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) return new Response(JSON.stringify({ success: new URLSearchParams(String(init.body)).get("response") === "good" }), { status: 200 });
  if (u.startsWith("https://api.clerk.com/v1/users/") && init?.method === "DELETE") { clerkDeletes.push(u); return new Response("{}", { status: 200 }); }
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

const webp = () => { const b = new Uint8Array(40); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b; };
const boot = (extra: Record<string, string> = {}) => {
  env = makeEnv(extra);
  call = makeClient(env, { now: () => t, fetch: fetchStub });
};
beforeEach(() => { t = 1_790_000_000_000; brevo = []; clerkDeletes = []; n = 0; boot(); });

function page(): Content {
  let c = starterSkeleton();
  const [hero, text, , sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", "Hello Priya, this is for you.");
  c = setField(c, sig!.id, "name", "Abhi");
  return { ...c, blocks: c.blocks.filter((b) => b.type !== "gallery") };
}
const publish = async (user = "abhi", id = "pg_safe0001", slug = "priya") => {
  await call("PUT", `/pages/${id}`, { user, json: { title: "For Priya", content: page() } });
  expect((await call("POST", `/pages/${id}/publish`, { user, json: { slug } })).status).toBe(200);
};
const report = (json: object, slug = "priya") => call("POST", `/p/${slug}/report`, { json, headers: fresh() });
const open = async () => (await call("GET", "/admin/reports", { headers: ADMIN })).json.reports as any[];
const count = async (sql: string, ...a: unknown[]) => ((await env.DB.prepare(sql).bind(...a).first()) as any).n as number;

describe("reporting a page", () => {
  it("anyone can report a published page, and it waits for the owner of the site", async () => {
    await publish();
    const r = await report({ reason: "abuse", details: "  This is aimed at me  ", contact: "me@example.com" });
    expect(r.status).toBe(200);
    const [rep] = await open();
    expect(rep).toMatchObject({ slug: "priya", reason: "abuse", details: "This is aimed at me", contact: "me@example.com", status: "open", title: "For Priya" });
    expect(JSON.stringify(rep)).not.toMatch(/ip_hash/);
  });
  it("checks what it is given", async () => {
    await publish();
    expect((await report({ reason: "nonsense" })).status).toBe(400);
    expect((await report({})).status).toBe(400);
    expect((await report({ reason: "other" })).status).toBe(400); // "other" needs a few words
    expect((await report({ reason: "other", details: "x".repeat(900) })).status).toBe(200);
    expect(((await open())[0] as any).details).toHaveLength(600);
  });
  it("ignores bots that fill the hidden field", async () => {
    await publish();
    expect((await report({ reason: "spam", website: "http://spam" })).status).toBe(200);
    expect(await open()).toHaveLength(0);
  });
  it("cannot be used on private, unpublished or missing pages", async () => {
    await call("PUT", "/pages/pg_safe0001", { user: "abhi", json: { title: "t", content: page() } });
    expect((await report({ reason: "spam" })).status).toBe(404); // not published
    await publish("abhi", "pg_safe0002", "secret-one");
    await call("POST", "/pages/pg_safe0002/publish", { user: "abhi", json: { slug: "secret-one", visibility: "private" } });
    expect((await report({ reason: "spam" }, "secret-one")).status).toBe(404);
    expect((await report({ reason: "spam" }, "nothing-here")).status).toBe(404);
  });
  it("limits how often one visitor can report", async () => {
    await publish();
    const same = { "cf-connecting-ip": "9.9.9.9" };
    for (let i = 0; i < 5; i++) expect((await call("POST", "/p/priya/report", { json: { reason: "spam" }, headers: same })).status).toBe(200);
    expect((await call("POST", "/p/priya/report", { json: { reason: "spam" }, headers: same })).status).toBe(429);
  });
  it("asks for the spam check when it is switched on", async () => {
    boot({ TURNSTILE_SECRET: "ts-secret" });
    await publish();
    expect((await report({ reason: "spam" })).status).toBe(403);
    expect((await report({ reason: "spam", turnstile: "bad" })).status).toBe(403);
    expect(await open()).toHaveLength(0);
    expect((await report({ reason: "spam", turnstile: "good" })).status).toBe(200);
    expect(await open()).toHaveLength(1);
  });
  it("emails the site owner when email is on, and still saves it when it is off", async () => {
    boot({ BREVO_API_KEY: "k", MAIL_FROM: "owner@example.com", REPORT_EMAIL: "wabhi2009@gmail.com" });
    await publish();
    await report({ reason: "copyright", details: "My photo" });
    expect(brevo).toHaveLength(1);
    expect(brevo[0].to[0].email).toBe("wabhi2009@gmail.com");
    expect(brevo[0].subject).toContain("For Priya");
    expect(brevo[0].htmlContent).toContain("copyright");
    expect(brevo[0].headers).toBeUndefined(); // a note to the owner has no stop link

    boot();
    await publish();
    expect((await report({ reason: "spam" })).status).toBe(200);
    expect(brevo).toHaveLength(1);
  });
});

describe("the site owner's review", () => {
  it("is closed without the admin token", async () => {
    expect((await call("GET", "/admin/reports")).status).toBe(403);
    expect((await call("GET", "/admin/reports", { headers: { "x-admin-token": "wrong" } })).status).toBe(403);
    expect((await call("POST", "/admin/reports/rp_x/remove")).status).toBe(403);
    expect((await call("POST", "/admin/pages/pg_safe0001/restore")).status).toBe(403);
  });
  it("removing a page takes it offline, closes its reports and stops it being published again", async () => {
    await publish();
    await report({ reason: "abuse" });
    await report({ reason: "spam" });
    const [first] = await open();
    expect((await call("POST", `/admin/reports/${first.id}/remove`, { headers: ADMIN })).status).toBe(200);

    expect((await call("GET", "/p/priya")).status).toBe(404);
    expect(await open()).toHaveLength(0); // every open report on that page is closed
    const mine = (await call("GET", "/me/pages", { user: "abhi" })).json.pages[0];
    expect(mine.status).toBe("draft");
    expect(mine.takenDown).toMatchObject({ reason: "Reported: abuse" });
    const again = await call("POST", "/pages/pg_safe0001/publish", { user: "abhi", json: { slug: "priya" } });
    expect(again.status).toBe(403);
    expect(again.json.error).toContain("taken down");

    // a mistake can be undone
    expect((await call("POST", "/admin/pages/pg_safe0001/restore", { headers: ADMIN })).json.changed).toBe(1);
    expect((await call("POST", "/pages/pg_safe0001/publish", { user: "abhi", json: { slug: "priya" } })).status).toBe(200);
    expect((await call("GET", "/p/priya")).status).toBe(200);
  });
  it("dismissing leaves the page alone", async () => {
    await publish();
    await report({ reason: "other", details: "I just do not like it" });
    const [r] = await open();
    await call("POST", `/admin/reports/${r.id}/dismiss`, { headers: ADMIN });
    expect(await open()).toHaveLength(0);
    expect((await call("GET", "/p/priya")).status).toBe(200);
    expect(((await call("GET", "/admin/reports?status=all", { headers: ADMIN })).json.reports as any[])[0].status).toBe("dismissed");
  });
  it("unknown actions and reports are refused", async () => {
    expect((await call("POST", "/admin/reports/rp_nope/remove", { headers: ADMIN })).status).toBe(404);
    expect((await call("POST", "/admin/reports/rp_nope/explode", { headers: ADMIN })).status).toBe(400);
  });
});

describe("deleting an account", () => {
  const seed = async (user: string, id: string, slug: string, photo: string) => {
    await call("PUT", `/assets/${photo}`, { user, body: webp(), headers: { "content-type": "image/webp" } });
    const c = page();
    c.blocks[0]!.fields.cover = { asset: photo };
    await call("PUT", `/pages/${id}`, { user, json: { title: "Mine", content: c } });
    await call("POST", `/pages/${id}/publish`, { user, json: { slug } });
  };

  it("needs the word DELETE, and a sign-in", async () => {
    await seed("abhi", "pg_safe0001", "priya", "ast_mine0001");
    expect((await call("DELETE", "/me", { json: { confirm: "DELETE" } })).status).toBe(401);
    expect((await call("DELETE", "/me", { user: "abhi", json: {} })).status).toBe(400);
    expect((await call("DELETE", "/me", { user: "abhi", json: { confirm: "yes" } })).status).toBe(400);
    expect((await call("GET", "/p/priya")).status).toBe(200); // nothing happened
  });

  it("removes everything of theirs and nothing of anyone else's", async () => {
    boot({ BREVO_API_KEY: "k", MAIL_FROM: "owner@example.com", CRON_SECRET: "c" });
    await seed("abhi", "pg_safe0001", "priya", "ast_mine0001");
    await seed("meera", "pg_safe0002", "meera-page", "ast_hers0001");
    await call("POST", "/pages/pg_safe0001/deliveries", { user: "abhi", json: { toEmail: "x@example.com", fromName: "Abhi", sendAt: new Date(t + D).toISOString() } });
    await report({ reason: "spam" });
    await call("PUT", "/templates/my-template", { user: "abhi", json: { template: { id: "my-template", title: "T", description: "d", category: "x", version: 1 } } }); // may be refused; that is fine

    const r = await call("DELETE", "/me", { user: "abhi", json: { confirm: " delete " } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, pages: 1, photos: 1, loginRemoved: false });

    expect(await count("SELECT COUNT(*) AS n FROM pages WHERE owner_id = 'dev_abhi'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM assets WHERE owner_id = 'dev_abhi'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM asset_blobs WHERE id = 'ast_mine0001'")).toBe(0);
    expect(env.FILES.keys()).not.toContain("a/ast_mine0001");
    expect(await count("SELECT COUNT(*) AS n FROM deliveries")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM reports")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM users WHERE id = 'dev_abhi'")).toBe(0);
    expect((await call("GET", "/p/priya")).status).toBe(404);

    // Meera is untouched
    expect((await call("GET", "/p/meera-page")).status).toBe(200);
    expect(env.FILES.keys()).toContain("a/ast_hers0001");
    expect(await count("SELECT COUNT(*) AS n FROM pages WHERE owner_id = 'dev_meera'")).toBe(1);
  });

  it("also removes the login from Clerk when the server may", async () => {
    const { sign, verify } = await makeJwtSetup();
    const e = makeEnv({ CLERK_SECRET_KEY: "sk_test_abc" });
    const c2 = makeClient(e, { now: () => t, fetch: fetchStub, verify });
    const token = await sign("user_clerk1");
    const auth = { authorization: `Bearer ${token}` };
    await c2("PUT", "/pages/pg_safe0003", { headers: auth, json: { title: "x", content: page() } });
    const r = await c2("DELETE", "/me", { headers: auth, json: { confirm: "DELETE" } });
    expect(r.json).toMatchObject({ ok: true, loginRemoved: true });
    expect(clerkDeletes).toEqual(["https://api.clerk.com/v1/users/user_clerk1"]);
    expect(await ((e.DB.prepare("SELECT COUNT(*) AS n FROM pages").first()) as Promise<any>).then((x) => x.n)).toBe(0);
  });
});

describe("old deleted data goes after 30 days", () => {
  const tick = () => call("POST", "/cron/tick", { headers: { authorization: "Bearer cron-1" } });
  beforeEach(() => boot({ CRON_SECRET: "cron-1" })); // email is NOT set up: the clean-up must still run

  it("removes a deleted page and its photo only after the grace period", async () => {
    await call("PUT", "/assets/ast_old00001", { user: "abhi", body: webp(), headers: { "content-type": "image/webp" } });
    const c = page();
    c.blocks[0]!.fields.cover = { asset: "ast_old00001" };
    await call("PUT", "/pages/pg_safe0001", { user: "abhi", json: { title: "Old", content: c } });
    await call("DELETE", "/pages/pg_safe0001", { user: "abhi" });

    t += 20 * D;
    await tick();
    expect(await count("SELECT COUNT(*) AS n FROM pages")).toBe(1); // still within the 30 days
    expect(await count("SELECT COUNT(*) AS n FROM assets")).toBe(1);

    t += 12 * D;
    const r = await tick();
    expect(r.status).toBe(200);
    expect(r.json.cleaned).toMatchObject({ pages: 1, photos: 1 });
    expect(await count("SELECT COUNT(*) AS n FROM pages")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM assets")).toBe(0);
    expect(env.FILES.keys()).toHaveLength(0);
  });

  it("keeps photos that a page still uses, and pages that were never deleted", async () => {
    await call("PUT", "/assets/ast_keep0001", { user: "abhi", body: webp(), headers: { "content-type": "image/webp" } });
    const c = page();
    c.blocks[0]!.fields.cover = { asset: "ast_keep0001" };
    await call("PUT", "/pages/pg_safe0001", { user: "abhi", json: { title: "Live", content: c } });
    t += 90 * D;
    await tick();
    expect(await count("SELECT COUNT(*) AS n FROM pages")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM assets")).toBe(1);
  });

  it("forgets reports that were dealt with a year ago", async () => {
    await publish();
    await report({ reason: "spam" });
    const [r] = await open();
    await call("POST", `/admin/reports/${r.id}/dismiss`, { headers: ADMIN });
    t += 366 * D;
    await tick();
    expect(await count("SELECT COUNT(*) AS n FROM reports")).toBe(0);
  });
});
