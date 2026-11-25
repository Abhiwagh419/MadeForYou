import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS, setField, starterSkeleton, stripPersonal, type Content } from "@madeforyou/schema";
import { getTemplate } from "@madeforyou/templates";
import { createApp } from "../src";
import { makeClient, makeEnv, makeJwtSetup, SECRET } from "../src/testing";

const makeApp = (e: ReturnType<typeof makeEnv>) => {
  const app = createApp({ now: () => 1_790_000_000_000 });
  return (path: string) => app.request(path, {}, e);
};

const webp = () => {
  const b = new Uint8Array(40);
  b.set([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  return b;
};
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 74, 70, 73, 70, 0, 1]);

function ready(): Content {
  let c = starterSkeleton();
  const [hero, text, gallery, sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", "A secret message only Priya should read.");
  c = setField(c, gallery!.id, "items", [{ image: { asset: "ast_photo1", alt: "us" }, caption: "us" }]);
  c = setField(c, sig!.id, "name", "Abhi");
  return c;
}

let env: ReturnType<typeof makeEnv>;
let call: ReturnType<typeof makeClient>;
let t = 1_790_000_000_000;
beforeEach(() => {
  env = makeEnv();
  t = 1_790_000_000_000;
  call = makeClient(env, { now: () => t });
});

const savePage = (user: string, id: string, content: Content = ready(), title = "For Priya") => call("PUT", `/pages/${id}`, { user, json: { title, content } });
const upload = (user: string, id: string, bytes = webp(), type = "image/webp") => call("PUT", `/assets/${id}`, { user, body: bytes, headers: { "content-type": type } });
const publish = (user: string, id: string, body: object = {}) => call("POST", `/pages/${id}/publish`, { user, json: { slug: "priya", ...body } });

describe("sign-in", () => {
  it("refuses requests without a login", async () => {
    expect((await call("GET", "/me/pages")).status).toBe(401);
    expect((await call("PUT", "/pages/pg_abcdef1", { json: {} })).status).toBe(401);
  });
  it("dev logins work only when switched on", async () => {
    const off = makeClient(makeEnv({ ALLOW_DEV_AUTH: "0" }));
    expect((await off("GET", "/me/pages", { user: "abhi" })).status).toBe(401);
    expect((await call("GET", "/me/pages", { user: "abhi" })).status).toBe(200);
  });
  it("accepts a real signed token, and rejects a forged or wrong-issuer one", async () => {
    const jwt = await makeJwtSetup();
    const c = makeClient(makeEnv({ ALLOW_DEV_AUTH: "0" }), { verify: jwt.verify });
    const good = await jwt.sign("user_123");
    expect((await c("GET", "/me/pages", { headers: { authorization: `Bearer ${good}` } })).status).toBe(200);
    const wrongIssuer = await jwt.sign("user_123", { iss: "https://evil.example" });
    expect((await c("GET", "/me/pages", { headers: { authorization: `Bearer ${wrongIssuer}` } })).status).toBe(401);
    expect((await c("GET", "/me/pages", { headers: { authorization: `Bearer ${good}x` } })).status).toBe(401);
    const expired = await jwt.sign("user_123", { exp: "1s" });
    await new Promise((r) => setTimeout(r, 1500));
    expect((await c("GET", "/me/pages", { headers: { authorization: `Bearer ${expired}` } })).status).toBe(401);
  });
});

describe("saving pages", () => {
  it("creates, lists and updates a page", async () => {
    expect((await savePage("abhi", "pg_abcdef1")).status).toBe(200);
    const list = await call("GET", "/me/pages", { user: "abhi" });
    expect(list.json.pages).toHaveLength(1);
    expect(list.json.pages[0].title).toBe("For Priya");
    expect((await savePage("abhi", "pg_abcdef1", ready(), "Renamed")).json.page.title).toBe("Renamed");
    expect((await call("GET", "/me/pages", { user: "abhi" })).json.pages).toHaveLength(1);
  });
  it("validates content on the server, whatever the browser sent", async () => {
    const bad = ready();
    (bad.blocks[0] as { type: string }).type = "script";
    const r = await savePage("abhi", "pg_abcdef1", bad);
    expect(r.status).toBe(400);
    expect((await call("PUT", "/pages/pg_abcdef1", { user: "abhi", json: { title: "x", content: { nope: 1 } } })).status).toBe(400);
    expect((await call("PUT", "/pages/pg_abcdef1", { user: "abhi", json: { title: "", content: ready() } })).status).toBe(400);
  });
  it("keeps one person's pages away from another", async () => {
    await savePage("abhi", "pg_abcdef1");
    expect((await savePage("mallory", "pg_abcdef1")).status).toBe(404);
    expect((await call("GET", "/me/pages", { user: "mallory" })).json.pages).toHaveLength(0);
    expect((await call("DELETE", "/pages/pg_abcdef1", { user: "mallory" })).status).toBe(404);
    expect((await publish("mallory", "pg_abcdef1")).status).toBe(404);
  });
  it("caps pages per person", async () => {
    for (let i = 0; i < 30; i++) expect((await savePage("abhi", `pg_cap${String(i).padStart(4, "0")}`)).status).toBe(200);
    expect((await savePage("abhi", "pg_onetoomany")).status).toBe(403);
  });
  it("deleting frees the link", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1");
    expect((await call("GET", "/slug/priya?page=pg_other123")).json.status).toBe("taken");
    await call("DELETE", "/pages/pg_abcdef1", { user: "abhi" });
    expect((await call("GET", "/slug/priya?page=pg_other123")).json.status).toBe("ok");
    expect((await call("GET", "/p/priya")).status).toBe(404);
  });
});

describe("publishing", () => {
  it("refuses an unfinished page and says what is missing", async () => {
    await savePage("abhi", "pg_abcdef1", starterSkeleton());
    const r = await publish("abhi", "pg_abcdef1");
    expect(r.status).toBe(422);
    expect(r.json.issues.length).toBeGreaterThan(0);
  });
  it("publishes a finished page and never returns the password hash", async () => {
    await savePage("abhi", "pg_abcdef1");
    const r = await publish("abhi", "pg_abcdef1", { password: "zq7-secret-pass" });
    expect(r.status).toBe(200);
    expect(r.json.page.status).toBe("published");
    expect(r.json.page.access.hasPassword).toBe(true);
    expect(r.text).not.toMatch(/password_hash|password_salt/);
    expect(r.text).not.toContain("zq7-secret-pass");
  });
  it("enforces link rules and uniqueness", async () => {
    await savePage("abhi", "pg_abcdef1");
    await savePage("sam", "pg_sam00001");
    expect((await publish("abhi", "pg_abcdef1", { slug: "ab" })).status).toBe(400);
    expect((await publish("abhi", "pg_abcdef1", { slug: "api" })).status).toBe(400);
    expect((await publish("abhi", "pg_abcdef1", { slug: "Bad Link!" })).status).toBe(400);
    expect((await publish("abhi", "pg_abcdef1")).status).toBe(200);
    expect((await publish("sam", "pg_sam00001")).status).toBe(409);
    expect((await publish("abhi", "pg_abcdef1")).status).toBe(200);
  });
  it("validates dates and password length", async () => {
    await savePage("abhi", "pg_abcdef1");
    expect((await publish("abhi", "pg_abcdef1", { password: "ab" })).status).toBe(400);
    expect((await publish("abhi", "pg_abcdef1", { unlockAt: "not a date" })).status).toBe(400);
    expect((await publish("abhi", "pg_abcdef1", { unlockAt: "2027-01-02T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" })).status).toBe(400);
  });
});

describe("what a visitor can see (the core promise)", () => {
  const SECRETS = ["A secret message only Priya should read.", "Happy Birthday Priya", "ast_photo1", "Abhi"];
  const noLeak = (text: string) => SECRETS.forEach((s) => expect(text).not.toContain(s));

  it("an open page returns its content", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1");
    const r = await call("GET", "/p/priya");
    expect(r.json.state).toBe("open");
    expect(r.json.content.blocks.length).toBe(4);
    expect(r.json.assetToken).toBeTruthy();
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("a draft is invisible", async () => {
    await savePage("abhi", "pg_abcdef1");
    expect((await call("GET", "/p/priya")).status).toBe(404);
  });
  it("a locked page sends NO content before its time, then opens", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { unlockAt: new Date(t + 3_600_000).toISOString() });
    const early = await call("GET", "/p/priya");
    expect(early.json.state).toBe("locked");
    expect(early.json.unlockAt).toBeTruthy();
    noLeak(early.text);
    expect(early.json).not.toHaveProperty("content");
    expect(early.json).not.toHaveProperty("title");
    t += 3_600_001;
    expect((await call("GET", "/p/priya")).json.state).toBe("open");
  });
  it("a password page sends no content until the password is right", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { password: "rose" });
    const gate = await call("GET", "/p/priya");
    expect(gate.json.state).toBe("password");
    noLeak(gate.text);
    const wrong = await call("POST", "/p/priya/open", { json: { password: "lily" } });
    expect(wrong.status).toBe(401);
    noLeak(wrong.text);
    const right = await call("POST", "/p/priya/open", { json: { password: "rose" } });
    expect(right.json.state).toBe("open");
    expect(right.json.content.blocks.length).toBe(4);
  });
  it("locked beats password: a locked, password-protected page still reveals nothing", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { password: "rose", unlockAt: new Date(t + 3_600_000).toISOString() });
    const r = await call("POST", "/p/priya/open", { json: { password: "rose" } });
    expect(r.json.state).toBe("locked");
    noLeak(r.text);
  });
  it("slows down password guessing", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { password: "rose" });
    for (let i = 0; i < 8; i++) expect((await call("POST", "/p/priya/open", { json: { password: `guess${i}` } })).status).toBe(401);
    expect((await call("POST", "/p/priya/open", { json: { password: "rose" } })).status).toBe(429);
    t += 11 * 60_000;
    expect((await call("POST", "/p/priya/open", { json: { password: "rose" } })).json.state).toBe("open");
  });
  it("an ended page says so and sends nothing", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { expiresAt: new Date(t + 1000).toISOString() });
    t += 5000;
    const r = await call("GET", "/p/priya");
    expect(r.status).toBe(410);
    noLeak(r.text);
  });
  it("a private page is invisible to everyone but its owner, who skips the gates", async () => {
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { visibility: "private", password: "rose", unlockAt: new Date(t + 3_600_000).toISOString() });
    expect((await call("GET", "/p/priya")).status).toBe(404);
    expect((await call("GET", "/p/priya", { user: "mallory" })).status).toBe(404);
    const own = await call("GET", "/p/priya", { user: "abhi" });
    expect(own.json.state).toBe("open");
    expect(own.json.owner).toBe(true);
  });
});

describe("photos", () => {
  it("accepts a real image and rejects disguised or oversized files", async () => {
    expect((await upload("abhi", "ast_photo1")).status).toBe(200);
    expect((await upload("abhi", "ast_photo2", new TextEncoder().encode("<script>alert(1)</script>"), "image/webp")).status).toBe(415);
    expect((await upload("abhi", "ast_photo3", jpeg(), "image/webp")).status).toBe(415);
    expect((await upload("abhi", "ast_photo4", webp(), "image/svg+xml")).status).toBe(415);
    expect((await upload("abhi", "bad id!")).status).toBe(400);
    const big = new Uint8Array(LIMITS.assetBytes + 10);
    big.set(webp());
    expect((await upload("abhi", "ast_photo5", big)).status).toBe(413);
  });
  it("enforces each person's storage allowance", async () => {
    const chunk = new Uint8Array(1.4 * 1024 * 1024);
    chunk.set(webp());
    const fits = Math.floor(LIMITS.userBytes / chunk.byteLength);
    for (let i = 0; i < fits; i++) expect((await upload("abhi", `ast_fill${String(i).padStart(2, "0")}`, chunk)).status).toBe(200);
    expect((await upload("abhi", "ast_fill_over", chunk)).status).toBe(413);
    expect((await upload("sam", "ast_samphoto", chunk)).status).toBe(200);
  });
  it("nobody can take over another person's photo id", async () => {
    await upload("abhi", "ast_photo1");
    expect((await upload("mallory", "ast_photo1")).status).toBe(409);
  });
  it("serves a photo only to its owner or to a visitor who got past the gates", async () => {
    await upload("abhi", "ast_photo1");
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { password: "rose" });

    expect((await call("GET", "/a/ast_photo1")).status).toBe(404);
    expect((await call("GET", "/a/ast_photo1?t=garbage")).status).toBe(404);

    const gated = await call("GET", "/p/priya");
    expect(gated.json.assetToken).toBeUndefined();

    const open = await call("POST", "/p/priya/open", { json: { password: "rose" } });
    const img = await call("GET", `/a/ast_photo1?t=${encodeURIComponent(open.json.assetToken)}`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/webp");
    expect(img.headers.get("cache-control")).toContain("private");

    const mine = await call("GET", "/me/token", { user: "abhi" });
    expect((await call("GET", `/a/ast_photo1?t=${encodeURIComponent(mine.json.token)}`)).status).toBe(200);
    const theirs = await call("GET", "/me/token", { user: "mallory" });
    expect((await call("GET", `/a/ast_photo1?t=${encodeURIComponent(theirs.json.token)}`)).status).toBe(404);
  });
  it("a token for one page does not open another page's photos", async () => {
    await upload("abhi", "ast_photo1");
    await upload("abhi", "ast_other11");
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1");
    const base = ready();
    await savePage("abhi", "pg_second01", setField(base, base.blocks[2]!.id, "items", [{ image: { asset: "ast_other11" } }]), "Second");
    await publish("abhi", "pg_second01", { slug: "second" });
    const open = await call("GET", "/p/priya");
    expect((await call("GET", `/a/ast_photo1?t=${encodeURIComponent(open.json.assetToken)}`)).status).toBe(200);
    expect((await call("GET", `/a/ast_other11?t=${encodeURIComponent(open.json.assetToken)}`)).status).toBe(404);
  });
  it("tokens expire", async () => {
    await upload("abhi", "ast_photo1");
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1");
    const open = await call("GET", "/p/priya");
    t += 7 * 3600 * 1000;
    expect((await call("GET", `/a/ast_photo1?t=${encodeURIComponent(open.json.assetToken)}`)).status).toBe(404);
  });
  it("a page cannot claim photos it does not own", async () => {
    await upload("abhi", "ast_photo1");
    await savePage("mallory", "pg_mal00001");
    await publish("mallory", "pg_mal00001", { slug: "stolen" });
    const open = await call("GET", "/p/stolen");
    expect((await call("GET", `/a/ast_photo1?t=${encodeURIComponent(open.json.assetToken)}`)).status).toBe(404);
  });
  it("an unpublished page's photos are not served to visitors", async () => {
    await upload("abhi", "ast_photo1");
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1");
    const open = await call("GET", "/p/priya");
    await call("POST", "/pages/pg_abcdef1/unpublish", { user: "abhi" });
    expect((await call("GET", `/a/ast_photo1?t=${encodeURIComponent(open.json.assetToken)}`)).status).toBe(404);
  });
});

describe("templates", () => {
  const template = (id: string, visibility: "private" | "unlisted" | "public" = "public") => {
    const base = getTemplate("thank-you-simple")!;
    return { meta: { ...base.meta, id, visibility }, content: base.content };
  };
  it("saves a stripped template, and lists only approved public ones", async () => {
    const stripped = stripPersonal(ready()).content;
    const own = { meta: { ...template("my-thanks").meta }, content: stripped };
    expect((await call("PUT", "/templates/my-thanks", { user: "abhi", json: { template: own } })).status).toBe(200);
    const mine = await call("GET", "/me/templates", { user: "abhi" });
    expect(mine.json.templates).toHaveLength(1);
    expect(mine.json.templates[0].status).toBe("pending");
    expect((await call("GET", "/templates")).json.templates).toHaveLength(0);
    expect((await call("POST", "/admin/templates/my-thanks/approve", { headers: { "x-admin-token": "nope" } })).status).toBe(403);
    expect((await call("POST", "/admin/templates/my-thanks/approve", { headers: { "x-admin-token": "admin-token-123" } })).json.changed).toBe(1);
    expect((await call("GET", "/templates")).json.templates).toHaveLength(1);
  });
  it("lets a trusted creator (three approved) publish instantly", async () => {
    for (const n of ["one-t", "two-t", "three-t"]) {
      await call("PUT", `/templates/${n}`, { user: "abhi", json: { template: template(n) } });
      await call("POST", `/admin/templates/${n}/approve`, { headers: { "x-admin-token": "admin-token-123" } });
    }
    expect((await call("PUT", "/templates/four-t", { user: "abhi", json: { template: template("four-t") } })).json.status).toBe("approved");
  });
  it("refuses a template that still contains photos", async () => {
    const t = template("leaky-one");
    const withPhoto = setField(t.content, t.content.blocks[0]!.id, "cover", { asset: "ast_photo1" });
    const r = await call("PUT", "/templates/leaky-one", { user: "abhi", json: { template: { meta: t.meta, content: withPhoto } } });
    expect(r.status).toBe(400);
  });
  it("rejects invalid templates, id mismatches and other people's ids", async () => {
    expect((await call("PUT", "/templates/x-y", { user: "abhi", json: { template: { meta: {}, content: {} } } })).status).toBe(400);
    expect((await call("PUT", "/templates/other-id", { user: "abhi", json: { template: template("my-thanks") } })).status).toBe(400);
    await call("PUT", "/templates/my-thanks", { user: "abhi", json: { template: template("my-thanks", "private") } });
    expect((await call("PUT", "/templates/my-thanks", { user: "mallory", json: { template: template("my-thanks", "private") } })).status).toBe(409);
  });
});

describe("hardening", () => {
  it("rejects oversized JSON", async () => {
    const r = await call("PUT", "/pages/pg_abcdef1", { user: "abhi", headers: { "content-length": "900000", "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(413);
  });
  it("hides internal errors", async () => {
    const broken = makeEnv();
    broken.DB.prepare = () => {
      throw new Error("secret database detail");
    };
    const c = makeClient(broken);
    const r = await c("GET", "/me/pages", { user: "abhi" });
    expect(r.status).toBe(500);
    expect(r.text).not.toContain("secret database detail");
  });
  it("signs tokens with the configured secret only", async () => {
    await upload("abhi", "ast_photo1");
    const other = makeClient({ ...env, SESSION_SECRET: "a-different-secret-a-different-secret" } as never, { now: () => t });
    const mine = await call("GET", "/me/token", { user: "abhi" });
    expect((await other("GET", `/a/ast_photo1?t=${encodeURIComponent(mine.json.token)}`)).status).toBe(404);
    expect(SECRET.length).toBeGreaterThan(16);
  });
});

describe("photos stored in the database (no R2 bucket, no card needed)", () => {
  beforeEach(() => {
    env = makeEnv({ FILES: undefined });
    call = makeClient(env, { now: () => t });
  });
  const bytes = () => {
    const b = new Uint8Array(2000);
    b.set(webp());
    for (let i = 40; i < b.length; i++) b[i] = i % 251;
    return b;
  };

  it("stores and serves a photo byte for byte, under the same access rules", async () => {
    await upload("abhi", "ast_photo1", bytes());
    await savePage("abhi", "pg_abcdef1");
    await publish("abhi", "pg_abcdef1", { password: "zq7-secret-pass" });
    expect((await call("GET", "/a/ast_photo1")).status).toBe(404);
    const open = await call("POST", "/p/priya/open", { json: { password: "zq7-secret-pass" } });
    const res = await makeApp(env)(`/api/a/ast_photo1?t=${encodeURIComponent(open.json.assetToken)}`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes());
  });
  it("replacing a photo replaces its bytes, and another user cannot overwrite it", async () => {
    await upload("abhi", "ast_photo1", bytes());
    const smaller = bytes().slice(0, 100);
    expect((await upload("abhi", "ast_photo1", smaller)).status).toBe(200);
    expect((await upload("mallory", "ast_photo1", bytes())).status).toBe(409);
    const mine = await call("GET", "/me/token", { user: "abhi" });
    const res = await makeApp(env)(`/api/a/ast_photo1?t=${encodeURIComponent(mine.json.token)}`);
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });
  it("reports how full the free database is", async () => {
    await upload("abhi", "ast_photo1", bytes());
    expect((await call("GET", "/admin/usage")).status).toBe(403);
    const r = await call("GET", "/admin/usage", { headers: { "x-admin-token": "admin-token-123" } });
    expect(r.json.photos).toBe(1);
    expect(r.json.storage).toContain("database");
  });
});
