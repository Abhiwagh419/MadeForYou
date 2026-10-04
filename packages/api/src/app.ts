import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  LIMITS, assetIds, checkPublishable, gateState, isAssetId, slugStatus, validateContent, validateTemplate,
  type Content,
} from "@madeforyou/schema";
import { authenticate, verifyClerk } from "./auth";
import { hashIp, hashPassword, randomHex, readToken, signToken, timingSafeEqual } from "./crypto";
import { sniffImage } from "./sniff";
import type { Deps, Env } from "./types";

type Vars = { userId: string | null };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const PAGE_ID = /^pg_[a-z0-9]{6,24}$/;
const TEMPLATE_ID = /^[a-z0-9-]{2,40}$/;
const GATE_TTL = 6 * 3600;
const MAX_JSON_BYTES = 400_000;

interface PageRow {
  id: string; owner_id: string; title: string; template_id: string | null; content: string; slug: string | null;
  status: "draft" | "published"; visibility: "private" | "unlisted"; password_hash: string | null; password_salt: string | null;
  unlock_at: string | null; expires_at: string | null; created_at: string; updated_at: string; published_at: string | null;
}

/** A page as the owner's browser sees it. The password hash never leaves the server. */
const toPage = (r: PageRow) => ({
  id: r.id, title: r.title, templateId: r.template_id ?? undefined, content: JSON.parse(r.content) as Content, slug: r.slug ?? "",
  status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, publishedAt: r.published_at ?? undefined,
  access: { visibility: r.visibility, hasPassword: !!r.password_hash, unlockAt: r.unlock_at, expiresAt: r.expires_at },
});

const isoOrNull = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new HttpError(400, "That date is not valid");
  return new Date(v).toISOString();
};

class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

async function readJson<T>(c: Ctx): Promise<T> {
  const len = Number(c.req.header("content-length") ?? 0);
  if (len > MAX_JSON_BYTES) throw new HttpError(413, "That is too large");
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, "Send valid JSON");
  }
}

export function createApp(overrides: Partial<Deps> = {}) {
  const deps: Deps = { verify: verifyClerk, now: () => Date.now(), ...overrides };
  const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

  app.use("*", async (c, next) => {
    const origin = c.env.ALLOWED_ORIGIN;
    if (origin) return cors({ origin, allowHeaders: ["Authorization", "Content-Type"], allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], maxAge: 600 })(c, next);
    await next();
  });
  app.use("*", async (c, next) => {
    c.set("userId", await authenticate(c.req.header("authorization"), c.env, deps));
    await next();
    c.header("Cache-Control", c.res.headers.get("Cache-Control") ?? "no-store");
    c.header("X-Content-Type-Options", "nosniff");
  });

  app.onError((e, c) => {
    if (e instanceof HttpError) return c.json({ error: e.message, ...e.extra }, e.status as 400);
    console.error(e);
    return c.json({ error: "Something went wrong on our side" }, 500);
  });

  const need = async (c: Ctx): Promise<string> => {
    const id = c.get("userId");
    if (!id) throw new HttpError(401, "Please sign in");
    await c.env.DB.prepare("INSERT INTO users (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING").bind(id, new Date(deps.now()).toISOString()).run();
    return id;
  };
  const iso = () => new Date(deps.now()).toISOString();

  /** Counts hits in a window and refuses once over the limit. */
  const throttle = async (c: Ctx, key: string, windowSec: number, max: number, record = true) => {
    const since = deps.now() - windowSec * 1000;
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM throttle WHERE key = ? AND at > ?").bind(key, since).first<{ n: number }>();
    if ((row?.n ?? 0) >= max) throw new HttpError(429, "Too many tries. Please wait a few minutes.");
    if (record) {
      await c.env.DB.prepare("INSERT INTO throttle (key, at) VALUES (?, ?)").bind(key, deps.now()).run();
      if (Math.random() < 0.02) await c.env.DB.prepare("DELETE FROM throttle WHERE at < ?").bind(deps.now() - 86_400_000).run();
    }
  };
  const ipOf = (c: Ctx) => hashIp(c.env.SESSION_SECRET, c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "local");

  const ownedPage = async (c: Ctx, id: string, userId: string): Promise<PageRow> => {
    if (!PAGE_ID.test(id)) throw new HttpError(404, "Page not found");
    const row = await c.env.DB.prepare("SELECT * FROM pages WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, userId).first<PageRow>();
    if (!row) throw new HttpError(404, "Page not found");
    return row;
  };

  app.get("/health", (c) => c.json({ ok: true }));

  /* ------------------------------ owner: pages ------------------------------ */

  app.get("/me/pages", async (c) => {
    const userId = await need(c);
    const { results } = await c.env.DB.prepare("SELECT * FROM pages WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC").bind(userId).all<PageRow>();
    return c.json({ pages: (results ?? []).map(toPage) });
  });

  app.get("/me/token", async (c) => {
    const userId = await need(c);
    return c.json({ token: await signToken(c.env.SESSION_SECRET, `u:${userId}`, GATE_TTL, deps.now()), expiresIn: GATE_TTL });
  });

  app.put("/pages/:id", async (c) => {
    const userId = await need(c);
    const id = c.req.param("id");
    if (!PAGE_ID.test(id)) throw new HttpError(400, "That page id is not valid");
    const body = await readJson<{ title?: unknown; templateId?: unknown; content?: unknown }>(c);

    const title = typeof body.title === "string" ? body.title.trim().slice(0, LIMITS.titleChars) : "";
    if (!title) throw new HttpError(400, "Give the page a name");
    const checked = validateContent(body.content);
    if (!checked.ok) throw new HttpError(400, "This page has a problem we cannot save", { issues: checked.issues.slice(0, 10) });
    const templateId = typeof body.templateId === "string" && TEMPLATE_ID.test(body.templateId) ? body.templateId : null;

    const existing = await c.env.DB.prepare("SELECT id, owner_id FROM pages WHERE id = ?").bind(id).first<{ id: string; owner_id: string }>();
    if (existing && existing.owner_id !== userId) throw new HttpError(404, "Page not found");
    if (!existing) {
      const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM pages WHERE owner_id = ? AND deleted_at IS NULL").bind(userId).first<{ n: number }>();
      if ((n?.n ?? 0) >= LIMITS.pagesPerUser) throw new HttpError(403, `You can keep up to ${LIMITS.pagesPerUser} pages. Delete one to make room.`);
    }

    const json = JSON.stringify(checked.content);
    const now = iso();
    const stmts = [
      existing
        ? c.env.DB.prepare("UPDATE pages SET title = ?, template_id = ?, content = ?, updated_at = ? WHERE id = ?").bind(title, templateId, json, now, id)
        : c.env.DB.prepare("INSERT INTO pages (id, owner_id, title, template_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, userId, title, templateId, json, now, now),
      c.env.DB.prepare("DELETE FROM page_assets WHERE page_id = ?").bind(id),
    ];
    // Link only photos the user really owns, so nobody can claim someone else's photo id.
    for (const a of assetIds(checked.content)) {
      stmts.push(c.env.DB.prepare("INSERT INTO page_assets (page_id, asset_id) SELECT ?, id FROM assets WHERE id = ? AND owner_id = ?").bind(id, a, userId));
    }
    await c.env.DB.batch(stmts);
    return c.json({ page: toPage(await ownedPage(c, id, userId)) });
  });

  app.delete("/pages/:id", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.param("id"), userId);
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE pages SET deleted_at = ?, slug = NULL, status = 'draft' WHERE id = ?").bind(iso(), row.id),
      c.env.DB.prepare("DELETE FROM page_assets WHERE page_id = ?").bind(row.id),
    ]);
    return c.json({ ok: true });
  });

  app.get("/slug/:slug", async (c) => {
    const slug = c.req.param("slug").toLowerCase();
    const mine = c.req.query("page") ?? "";
    const taken = await c.env.DB.prepare("SELECT 1 AS x FROM pages WHERE slug = ? AND id != ? AND deleted_at IS NULL").bind(slug, mine).first();
    return c.json({ status: slugStatus(slug, () => !!taken) });
  });

  app.post("/pages/:id/publish", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.param("id"), userId);
    const body = await readJson<{ slug?: unknown; visibility?: unknown; password?: unknown; unlockAt?: unknown; expiresAt?: unknown }>(c);

    const check = checkPublishable(JSON.parse(row.content) as Content);
    if (!check.canPublish) throw new HttpError(422, "A few things still need filling in", { issues: check.issues.filter((i) => i.severity === "error") });

    const slug = typeof body.slug === "string" ? body.slug.toLowerCase() : "";
    const taken = await c.env.DB.prepare("SELECT 1 AS x FROM pages WHERE slug = ? AND id != ? AND deleted_at IS NULL").bind(slug, row.id).first();
    const st = slugStatus(slug, () => !!taken);
    if (st !== "ok") throw new HttpError(st === "taken" ? 409 : 400, { short: "Use at least 3 characters", invalid: "Use only lowercase letters, numbers and single hyphens", reserved: "That word is reserved", taken: "Someone already has this link", ok: "" }[st]);

    const visibility = body.visibility === "private" ? "private" : "unlisted";
    const unlockAt = isoOrNull(body.unlockAt);
    const expiresAt = isoOrNull(body.expiresAt);
    if (unlockAt && expiresAt && Date.parse(expiresAt) <= Date.parse(unlockAt)) throw new HttpError(400, "The end date must be after the unlock time");

    let hash = row.password_hash;
    let salt = row.password_salt;
    if (body.password === null) {
      hash = salt = null;
    } else if (typeof body.password === "string" && body.password !== "") {
      if (body.password.length < 4 || body.password.length > 64) throw new HttpError(400, "Use a password of 4 to 64 characters");
      salt = randomHex(12);
      hash = await hashPassword(c.env.SESSION_SECRET, salt, body.password);
    }

    try {
      await c.env.DB.prepare(
        "UPDATE pages SET slug = ?, status = 'published', visibility = ?, password_hash = ?, password_salt = ?, unlock_at = ?, expires_at = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?",
      ).bind(slug, visibility, hash, salt, unlockAt === undefined ? row.unlock_at : unlockAt, expiresAt === undefined ? row.expires_at : expiresAt, iso(), iso(), row.id).run();
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new HttpError(409, "Someone already has this link");
      throw e;
    }
    return c.json({ page: toPage(await ownedPage(c, row.id, userId)) });
  });

  app.post("/pages/:id/unpublish", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.param("id"), userId);
    await c.env.DB.prepare("UPDATE pages SET status = 'draft', updated_at = ? WHERE id = ?").bind(iso(), row.id).run();
    return c.json({ page: toPage(await ownedPage(c, row.id, userId)) });
  });

  /* ------------------------------ visitors ------------------------------ */

  const publicRow = (c: Ctx, slug: string) =>
    c.env.DB.prepare("SELECT * FROM pages WHERE slug = ? AND status = 'published' AND deleted_at IS NULL").bind(slug.toLowerCase()).first<PageRow>();
  const presetOf = (r: PageRow) => (JSON.parse(r.content) as Content).settings.theme.preset;

  /** The only place page content leaves the server for a visitor. */
  const openPayload = async (c: Ctx, r: PageRow, owner: boolean) => ({
    state: "open" as const,
    title: r.title,
    content: JSON.parse(r.content) as Content,
    visibility: r.visibility,
    owner,
    assetToken: await signToken(c.env.SESSION_SECRET, `pg:${r.id}`, GATE_TTL, deps.now()),
  });

  /** Decides what a visitor may receive. Locked, ended and password states carry NO content. */
  const gate = async (c: Ctx, r: PageRow | null, passwordOk: boolean) => {
    if (!r) return c.json({ state: "missing" }, 404);
    const owner = !!c.get("userId") && c.get("userId") === r.owner_id;
    if (r.visibility === "private" && !owner) return c.json({ state: "missing" }, 404);
    if (owner) return c.json(await openPayload(c, r, true));
    const state = gateState({ unlockAt: r.unlock_at, expiresAt: r.expires_at, hasPassword: !!r.password_hash }, deps.now());
    if (state === "ended") return c.json({ state: "ended" }, 410);
    if (state === "locked") return c.json({ state: "locked", unlockAt: r.unlock_at, theme: presetOf(r) });
    if (state === "password" && !passwordOk) return c.json({ state: "password", theme: presetOf(r) });
    return c.json(await openPayload(c, r, false));
  };

  app.get("/p/:slug", async (c) => gate(c, await publicRow(c, c.req.param("slug")), false));

  app.post("/p/:slug/open", async (c) => {
    const r = await publicRow(c, c.req.param("slug"));
    const { password } = await readJson<{ password?: unknown }>(c);
    if (!r?.password_hash || !r.password_salt) return gate(c, r, false);
    const ip = await ipOf(c);
    await throttle(c, `pw:${r.id}:${ip}`, 600, 8, false); // refuse before doing any work once the limit is hit
    const ok = typeof password === "string" && timingSafeEqual(await hashPassword(c.env.SESSION_SECRET, r.password_salt, password), r.password_hash);
    if (!ok) {
      await c.env.DB.prepare("INSERT INTO throttle (key, at) VALUES (?, ?)").bind(`pw:${r.id}:${ip}`, deps.now()).run();
      return c.json({ state: "password", error: "That is not the password", theme: presetOf(r) }, 401);
    }
    return gate(c, r, true);
  });

  /* ------------------------------ photos ------------------------------ */

  const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png"]);

  app.put("/assets/:id", async (c) => {
    const userId = await need(c);
    const id = c.req.param("id");
    if (!isAssetId(id)) throw new HttpError(400, "That photo id is not valid");
    const type = (c.req.header("content-type") ?? "").split(";")[0]!.trim();
    if (!ALLOWED.has(type)) throw new HttpError(415, "Photos must be WebP, JPEG or PNG");
    if (Number(c.req.header("content-length") ?? 0) > LIMITS.assetBytes) throw new HttpError(413, "That photo is too large");
    await throttle(c, `up:${userId}`, 3600, 300);

    const buf = await c.req.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > LIMITS.assetBytes) throw new HttpError(413, "That photo is too large");
    if (sniffImage(new Uint8Array(buf)) !== type) throw new HttpError(415, "That file is not the kind of image it says it is");

    const existing = await c.env.DB.prepare("SELECT owner_id, bytes FROM assets WHERE id = ?").bind(id).first<{ owner_id: string; bytes: number }>();
    if (existing && existing.owner_id !== userId) throw new HttpError(409, "That photo id is taken");
    const used = await c.env.DB.prepare("SELECT COALESCE(SUM(bytes), 0) AS n FROM assets WHERE owner_id = ?").bind(userId).first<{ n: number }>();
    if ((used?.n ?? 0) - (existing?.bytes ?? 0) + buf.byteLength > LIMITS.userBytes) throw new HttpError(413, "You have used all your free photo space. Delete some pages to free it up.");

    await c.env.FILES.put(`a/${id}`, buf, { httpMetadata: { contentType: type } });
    await c.env.DB.prepare("INSERT INTO assets (id, owner_id, content_type, bytes, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content_type = excluded.content_type, bytes = excluded.bytes")
      .bind(id, userId, type, buf.byteLength, iso()).run();
    return c.json({ id, bytes: buf.byteLength });
  });

  /** A photo is served only to its owner, or to a visitor holding a token issued after the page's gates were passed. */
  app.get("/a/:id", async (c) => {
    const id = c.req.param("id");
    const notFound = () => c.json({ error: "Not found" }, 404);
    if (!isAssetId(id)) return notFound();
    const asset = await c.env.DB.prepare("SELECT owner_id, content_type FROM assets WHERE id = ?").bind(id).first<{ owner_id: string; content_type: string }>();
    if (!asset) return notFound();

    const scope = await readToken(c.env.SESSION_SECRET, c.req.query("t"), deps.now());
    let allowed = false;
    if (scope?.startsWith("u:")) allowed = scope === `u:${asset.owner_id}`;
    else if (scope?.startsWith("pg:")) {
      const hit = await c.env.DB.prepare(
        "SELECT 1 AS x FROM page_assets pa JOIN pages p ON p.id = pa.page_id WHERE pa.asset_id = ? AND pa.page_id = ? AND p.status = 'published' AND p.deleted_at IS NULL",
      ).bind(id, scope.slice(3)).first();
      allowed = !!hit;
    }
    if (!allowed) return notFound();

    const obj = await c.env.FILES.get(`a/${id}`);
    if (!obj) return notFound();
    return new Response(obj.body, { headers: { "Content-Type": asset.content_type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  });

  /* ------------------------------ templates ------------------------------ */

  const rowToTemplate = (r: { meta: string; content: string }) => ({ meta: JSON.parse(r.meta), content: JSON.parse(r.content) });

  app.get("/templates", async (c) => {
    const { results } = await c.env.DB.prepare("SELECT meta, content FROM templates WHERE visibility = 'public' AND status = 'approved' ORDER BY created_at DESC LIMIT 200").all<{ meta: string; content: string }>();
    c.header("Cache-Control", "public, max-age=60");
    return c.json({ templates: (results ?? []).map(rowToTemplate) });
  });

  app.get("/me/templates", async (c) => {
    const userId = await need(c);
    const { results } = await c.env.DB.prepare("SELECT meta, content, status FROM templates WHERE owner_id = ? ORDER BY created_at DESC").bind(userId).all<{ meta: string; content: string; status: string }>();
    return c.json({ templates: (results ?? []).map((r) => ({ ...rowToTemplate(r), status: r.status })) });
  });

  app.put("/templates/:id", async (c) => {
    const userId = await need(c);
    const id = c.req.param("id");
    const body = await readJson<{ template?: unknown; fromPage?: unknown }>(c);
    const checked = validateTemplate(body.template);
    if (!checked.ok) throw new HttpError(400, "This template has a problem", { issues: checked.issues.slice(0, 10) });
    const { meta, content } = checked.template;
    if (!TEMPLATE_ID.test(id) || meta.id !== id) throw new HttpError(400, "The template id does not match");
    // Photos are personal by nature: a template carries structure only.
    if (assetIds(content).length) throw new HttpError(400, "Templates cannot contain photos. Remove them and try again.");

    const existing = await c.env.DB.prepare("SELECT owner_id FROM templates WHERE id = ?").bind(id).first<{ owner_id: string }>();
    if (existing && existing.owner_id !== userId) throw new HttpError(409, "That template name is taken");
    if (!existing) {
      const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM templates WHERE owner_id = ?").bind(userId).first<{ n: number }>();
      if ((n?.n ?? 0) >= 50) throw new HttpError(403, "You can keep up to 50 templates");
    }
    // New creators' public templates wait for a quick review until three have been approved.
    let status = "approved";
    if (meta.visibility === "public") {
      const ok = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM templates WHERE owner_id = ? AND visibility = 'public' AND status = 'approved' AND id != ?").bind(userId, id).first<{ n: number }>();
      status = (ok?.n ?? 0) >= 3 ? "approved" : "pending";
    }
    const fromPage = typeof body.fromPage === "string" && PAGE_ID.test(body.fromPage) ? body.fromPage : null;
    await c.env.DB.prepare(
      "INSERT INTO templates (id, owner_id, meta, content, visibility, status, from_page, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET meta = excluded.meta, content = excluded.content, visibility = excluded.visibility, status = excluded.status",
    ).bind(id, userId, JSON.stringify(meta), JSON.stringify(content), meta.visibility, status, fromPage, iso()).run();
    return c.json({ id, status });
  });

  app.delete("/templates/:id", async (c) => {
    const userId = await need(c);
    await c.env.DB.prepare("DELETE FROM templates WHERE id = ? AND owner_id = ?").bind(c.req.param("id"), userId).run();
    return c.json({ ok: true });
  });

  const admin = (c: Ctx) => {
    const t = c.req.header("x-admin-token") ?? "";
    if (!c.env.ADMIN_TOKEN || !timingSafeEqual(t, c.env.ADMIN_TOKEN)) throw new HttpError(403, "Not allowed");
  };
  app.post("/admin/templates/:id/:action", async (c) => {
    admin(c);
    const action = c.req.param("action");
    if (action !== "approve" && action !== "reject") throw new HttpError(400, "Unknown action");
    const r = await c.env.DB.prepare("UPDATE templates SET status = ? WHERE id = ?").bind(action === "approve" ? "approved" : "rejected", c.req.param("id")).run();
    return c.json({ ok: true, changed: r.meta?.changes ?? 0 });
  });
  app.get("/admin/templates/pending", async (c) => {
    admin(c);
    const { results } = await c.env.DB.prepare("SELECT id, owner_id, meta, created_at FROM templates WHERE status = 'pending' ORDER BY created_at").all();
    return c.json({ pending: results ?? [] });
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
