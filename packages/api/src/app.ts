import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  LIMITS, SUBMISSION, assetIds, checkPublishable, cleanEmail, cleanSubmission, gateState, isAssetId, slugStatus, validateContent, validateTemplate,
  type Content, type SubmissionKind,
} from "@madeforyou/schema";
import { authenticate, diagnose, verifyClerk } from "./auth";
import { hashIp, hashPassword, randomHex, readToken, signToken, timingSafeEqual } from "./crypto";
import { DAILY_CAP, blockEmail, contactAddress, deliverOne, escHtml, isBlocked, mailConfig, nextEvent, notifyDecision, notifyOwnerReported, notifyReport, readUnsub, remindersOn, runTick } from "./mail";
import { eraseUser, purgeOld } from "./safety";
import { sniffMedia } from "./sniff";
import type { Deps, Env } from "./types";

type Vars = { userId: string | null };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const PAGE_ID = /^pg_[a-z0-9]{6,24}$/;
const TEMPLATE_ID = /^[a-z0-9-]{2,40}$/;
const GATE_TTL = 6 * 3600;
const CONTRIB_TTL = 90 * 86400;
const MAX_JSON_BYTES = 400_000;

interface PageRow {
  id: string; owner_id: string; title: string; template_id: string | null; content: string; slug: string | null;
  status: "draft" | "published"; visibility: "private" | "unlisted"; password_hash: string | null; password_salt: string | null;
  unlock_at: string | null; expires_at: string | null; created_at: string; updated_at: string; published_at: string | null;
  contrib_epoch: number; taken_down_at: string | null; takedown_reason: string | null;
}

/** A page as the owner's browser sees it. The password hash never leaves the server. */
const toPage = (r: PageRow) => ({
  id: r.id, title: r.title, templateId: r.template_id ?? undefined, content: JSON.parse(r.content) as Content, slug: r.slug ?? "",
  status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, publishedAt: r.published_at ?? undefined,
  access: { visibility: r.visibility, hasPassword: !!r.password_hash, unlockAt: r.unlock_at, expiresAt: r.expires_at },
  takenDown: r.taken_down_at ? { at: r.taken_down_at, reason: r.takedown_reason ?? "" } : undefined,
});

const isoOrNull = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new HttpError(400, "That date is not valid");
  return new Date(v).toISOString();
};

/** Photo storage: R2 when a bucket is bound, otherwise the database itself. */
async function putFile(env: Env, id: string, buf: ArrayBuffer, type: string): Promise<void> {
  if (env.FILES) {
    await env.FILES.put(`a/${id}`, buf, { httpMetadata: { contentType: type } });
    return;
  }
  await env.DB.prepare("INSERT INTO asset_blobs (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").bind(id, buf).run();
}
async function getFile(env: Env, id: string): Promise<Uint8Array | null> {
  if (env.FILES) {
    const o = await env.FILES.get(`a/${id}`);
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  }
  const row = await env.DB.prepare("SELECT data FROM asset_blobs WHERE id = ?").bind(id).first<{ data: ArrayLike<number> }>();
  return row ? new Uint8Array(row.data) : null;
}

class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

/**
 * Reads a request body, stopping as soon as it passes `max` bytes. The Content-Length header is only a hint
 * (it can be missing, as with chunked uploads, or simply wrong), so the bytes that really arrive are counted.
 */
async function readBody(c: Ctx, max: number, tooLarge: string): Promise<Uint8Array> {
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > max) throw new HttpError(413, tooLarge);
  const stream = c.req.raw.body;
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, tooLarge);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of chunks) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

async function readJson<T>(c: Ctx): Promise<T> {
  const bytes = await readBody(c, MAX_JSON_BYTES, "That is too large");
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new HttpError(400, "Send valid JSON");
  }
}

export function createApp(overrides: Partial<Deps> = {}) {
  const deps: Deps = { verify: verifyClerk, now: () => Date.now(), fetch: (...a) => fetch(...a), ...overrides };
  const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

  app.use("*", async (c, next) => {
    const origin = c.env.ALLOWED_ORIGIN;
    if (origin) return cors({ origin, allowHeaders: ["Authorization", "Content-Type", "Range", "x-admin-token"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], exposeHeaders: ["Content-Range", "Accept-Ranges"], maxAge: 600 })(c, next);
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

  /** "Why was my sign-in not accepted?" Safe to expose: it only repeats public Clerk addresses. */
  app.get("/diag", async (c) => c.json({ ...(await diagnose(c.req.header("authorization"), c.env, deps)), secretOk: (c.env.SESSION_SECRET ?? "").length >= 24 }));

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
    if (row.taken_down_at) throw new HttpError(403, "This page was taken down and cannot be published. Email wabhi2009@gmail.com if you think that was a mistake.");
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
  const openPayload = async (c: Ctx, r: PageRow, owner: boolean) => {
    const content = JSON.parse(r.content) as Content;
    // Only wishes the owner has approved are ever shown to visitors.
    const wishes: Record<string, { id: string; name: string; message: string; at: string }[]> = {};
    if (content.blocks.some((b) => b.type === "wishes")) {
      const { results } = await c.env.DB.prepare("SELECT id, block_id, payload, created_at FROM submissions WHERE page_id = ? AND kind = 'wish' AND status = 'approved' ORDER BY created_at DESC LIMIT 100")
        .bind(r.id).all<{ id: string; block_id: string; payload: string; created_at: string }>();
      for (const w of results ?? []) {
        const p = JSON.parse(w.payload) as { name: string; message: string };
        (wishes[w.block_id] ??= []).push({ id: w.id, name: p.name, message: p.message, at: w.created_at });
      }
    }
    return {
      state: "open" as const,
      title: r.title,
      content,
      visibility: r.visibility,
      owner,
      wishes,
      // true when a guest may leave an email on the RSVP to get one reminder before the event
      canRemind: remindersOn(c.env) && !!nextEvent(content, deps.now()),
      assetToken: await signToken(c.env.SESSION_SECRET, `pg:${r.id}`, GATE_TTL, deps.now()),
    };
  };

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

  const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png", "audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"]);

  app.put("/assets/:id", async (c) => {
    const userId = await need(c);
    const id = c.req.param("id");
    if (!isAssetId(id)) throw new HttpError(400, "That photo id is not valid");
    const type = (c.req.header("content-type") ?? "").split(";")[0]!.trim();
    if (!ALLOWED.has(type)) throw new HttpError(415, "Use a WebP, JPEG or PNG photo, or a WebM, MP4, OGG or MP3 voice note");
    await throttle(c, `up:${userId}`, 3600, 300);

    const bytes = await readBody(c, LIMITS.assetBytes, "That photo is too large");
    if (bytes.byteLength === 0) throw new HttpError(413, "That photo is empty");
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    if (sniffMedia(new Uint8Array(buf)) !== type) throw new HttpError(415, "That file is not the kind of image it says it is");

    const existing = await c.env.DB.prepare("SELECT owner_id, bytes FROM assets WHERE id = ?").bind(id).first<{ owner_id: string; bytes: number }>();
    if (existing && existing.owner_id !== userId) throw new HttpError(409, "That photo id is taken");
    const used = await c.env.DB.prepare("SELECT COALESCE(SUM(bytes), 0) AS n FROM assets WHERE owner_id = ?").bind(userId).first<{ n: number }>();
    if ((used?.n ?? 0) - (existing?.bytes ?? 0) + buf.byteLength > LIMITS.userBytes) throw new HttpError(413, "You have used all your free photo space. Delete some pages to free it up.");

    await c.env.DB.prepare("INSERT INTO assets (id, owner_id, content_type, bytes, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content_type = excluded.content_type, bytes = excluded.bytes")
      .bind(id, userId, type, buf.byteLength, iso()).run();
    await putFile(c.env, id, buf, type);
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
        // A pass is good for hours, so the page's CURRENT state is checked too: ended, re-locked or private pages stop serving photos at once.
        `SELECT 1 AS x FROM page_assets pa JOIN pages p ON p.id = pa.page_id
          WHERE pa.asset_id = ? AND pa.page_id = ? AND p.status = 'published' AND p.deleted_at IS NULL AND p.visibility != 'private'
            AND (p.expires_at IS NULL OR p.expires_at > ?) AND (p.unlock_at IS NULL OR p.unlock_at <= ?)`,
      ).bind(id, scope.slice(3), iso(), iso()).first();
      allowed = !!hit;
    }
    if (!allowed) return notFound();

    const bytes = await getFile(c.env, id);
    if (!bytes) return notFound();
    const headers: Record<string, string> = { "Content-Type": asset.content_type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };
    // Safari will not play audio unless the server understands byte ranges.
    const range = c.req.header("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const size = bytes.byteLength;
      if (range[1] && +range[1] >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      const start = range[1] ? +range[1] : Math.max(0, size - +range[2]!);
      const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      return new Response(bytes.slice(start, end + 1) as unknown as BodyInit, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
    }
    return new Response(bytes as unknown as BodyInit, { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
  });


  /* ------------------------------ guest messages ------------------------------ */

  const verifyTurnstile = async (c: Ctx, token: unknown): Promise<boolean> => {
    if (!c.env.TURNSTILE_SECRET) return true;
    if (typeof token !== "string" || !token) return false;
    try {
      const res = await deps.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET, response: token, remoteip: c.req.header("cf-connecting-ip") ?? "" }),
      });
      return ((await res.json()) as { success?: boolean }).success === true;
    } catch {
      return false;
    }
  };

  /** The one place a guest's message is accepted, whether it comes from the page or a contributor link. */
  const accept = async (c: Ctx, r: PageRow, input: { blockId: unknown; kind: SubmissionKind; payload: unknown; source: "page" | "contributor"; website?: unknown; elapsedMs?: unknown; turnstile?: unknown }) => {
    if (r.expires_at && Date.parse(r.expires_at) <= deps.now()) throw new HttpError(410, "This page has ended");
    const content = JSON.parse(r.content) as Content;
    const block = content.blocks.find((b) => b.id === input.blockId);
    const expected = block ? (SUBMISSION.blockKind as Record<string, SubmissionKind>)[block.type] : undefined;
    if (!block || expected !== input.kind) throw new HttpError(400, "That box is not on this page");

    if (typeof input.website === "string" && input.website !== "") return { ok: true, status: "approved" as const }; // a bot filled the hidden field: pretend it worked
    if (typeof input.elapsedMs === "number" && input.elapsedMs < SUBMISSION.minFillMs) throw new HttpError(429, "Please take a moment before sending");
    if (!(await verifyTurnstile(c, input.turnstile))) throw new HttpError(403, "We could not confirm you are a person. Please try again.");

    const ip = await ipOf(c);
    await throttle(c, `sub:${r.id}:${ip}`, 600, SUBMISSION.perVisitorPer10Min);
    await throttle(c, `subp:${r.id}`, 3600, SUBMISSION.perPagePerHour);
    const total = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE page_id = ?").bind(r.id).first<{ n: number }>();
    if ((total?.n ?? 0) >= SUBMISSION.maxPerPage) throw new HttpError(403, "This page cannot take more messages");

    const cleaned = cleanSubmission(input.kind, input.payload);
    if (!cleaned.ok) throw new HttpError(400, cleaned.error);
    const status = input.kind === "wish" && block.fields.moderation !== "auto" ? "pending" : "approved";
    let remindAt: string | null = null;
    let eventAt: string | null = null;
    if (input.kind === "rsvp" && cleaned.payload.email) {
      const email = String(cleaned.payload.email);
      const ev = remindersOn(c.env) ? nextEvent(content, deps.now()) : null;
      if (!ev || ev.at - deps.now() < 30 * 60_000 || (await isBlocked(c.env, email))) {
        delete cleaned.payload.email; // nothing to remind about, so the address is not kept
      } else {
        eventAt = new Date(ev.at).toISOString();
        remindAt = new Date(Math.max(deps.now(), ev.at - 86_400_000)).toISOString();
      }
    }
    const stmts = [];
    if (input.kind === "rsvp") {
      // answering again replaces the earlier answer instead of counting twice
      stmts.push(c.env.DB.prepare("DELETE FROM submissions WHERE page_id = ? AND block_id = ? AND kind = 'rsvp' AND lower(json_extract(payload, '$.name')) = ?").bind(r.id, block.id, String(cleaned.payload.name).toLowerCase()));
    }
    stmts.push(c.env.DB.prepare("INSERT INTO submissions (id, page_id, block_id, kind, payload, status, source, created_at, ip_hash, remind_at, event_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(`sb_${randomHex(8)}`, r.id, block.id, input.kind, JSON.stringify(cleaned.payload), status, input.source, iso(), ip, remindAt, eventAt));
    await c.env.DB.batch(stmts);
    return { ok: true, status };
  };

  app.post("/p/:slug/submit", async (c) => {
    const r = await publicRow(c, c.req.param("slug"));
    if (!r) throw new HttpError(404, "Page not found");
    const b = await readJson<{ blockId?: unknown; kind?: unknown; payload?: unknown; token?: unknown; website?: unknown; elapsedMs?: unknown; turnstile?: unknown }>(c);
    const owner = !!c.get("userId") && c.get("userId") === r.owner_id;
    if (r.visibility === "private" && !owner) throw new HttpError(404, "Page not found");
    // The visitor must have been let in (past the lock and password) to leave a message.
    const scope = await readToken(c.env.SESSION_SECRET, typeof b.token === "string" ? b.token : "", deps.now());
    if (scope !== `pg:${r.id}`) throw new HttpError(403, "Open the page first, then send your message");
    if (b.kind !== "wish" && b.kind !== "reply" && b.kind !== "rsvp") throw new HttpError(400, "Unknown kind of message");
    const out = await accept(c, r, { blockId: b.blockId, kind: b.kind, payload: b.payload, source: "page", website: b.website, elapsedMs: b.elapsedMs, turnstile: b.turnstile });
    return c.json(out);
  });

  /* contributor links: friends add a wish without ever seeing the page (so a surprise stays a surprise) */
  const contribScope = (r: PageRow) => `c:${r.id}:${r.contrib_epoch}`;
  const contributorRow = async (c: Ctx, slug: string): Promise<PageRow> => {
    const r = await publicRow(c, slug);
    const scope = await readToken(c.env.SESSION_SECRET, c.req.query("k"), deps.now());
    if (!r || !scope || scope !== contribScope(r)) throw new HttpError(404, "This invitation link is not valid any more");
    return r;
  };

  app.post("/pages/:id/contributor-link", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.param("id"), userId);
    if (row.status !== "published" || !row.slug) throw new HttpError(409, "Publish the page first");
    if (!(JSON.parse(row.content) as Content).blocks.some((b) => b.type === "wishes")) throw new HttpError(409, "Add a Wishes wall block first");
    const token = await signToken(c.env.SESSION_SECRET, contribScope(row), CONTRIB_TTL, deps.now());
    return c.json({ path: `/c/${row.slug}?k=${encodeURIComponent(token)}` });
  });

  /** Switching off the old link: every link sent so far stops working. */
  app.post("/pages/:id/contributor-link/reset", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.param("id"), userId);
    await c.env.DB.prepare("UPDATE pages SET contrib_epoch = contrib_epoch + 1 WHERE id = ?").bind(row.id).run();
    return c.json({ ok: true });
  });

  app.get("/c/:slug", async (c) => {
    const r = await contributorRow(c, c.req.param("slug"));
    if (r.expires_at && Date.parse(r.expires_at) <= deps.now()) throw new HttpError(410, "This page has ended");
    const content = JSON.parse(r.content) as Content;
    const wall = content.blocks.find((b) => b.type === "wishes");
    if (!wall) throw new HttpError(404, "This page has no wishes wall");
    const hero = content.blocks.find((b) => b.type === "hero");
    const recipient = hero && !hero.ph.includes("recipient") && typeof hero.fields.recipient === "string" ? hero.fields.recipient : "";
    return c.json({ blockId: wall.id, heading: wall.fields.title ?? "", prompt: wall.fields.prompt ?? "", recipient, theme: content.settings.theme.preset });
  });

  app.post("/c/:slug/submit", async (c) => {
    const r = await contributorRow(c, c.req.param("slug"));
    const b = await readJson<{ payload?: unknown; website?: unknown; elapsedMs?: unknown; turnstile?: unknown }>(c);
    const wall = (JSON.parse(r.content) as Content).blocks.find((x) => x.type === "wishes");
    if (!wall) throw new HttpError(404, "This page has no wishes wall");
    return c.json(await accept(c, r, { blockId: wall.id, kind: "wish", payload: b.payload, source: "contributor", website: b.website, elapsedMs: b.elapsedMs, turnstile: b.turnstile }));
  });

  /* ------------------------------ reports, takedowns, deleting an account ------------------------------ */

  const REASONS = ["abuse", "private", "copyright", "spam", "other"] as const;

  /** Anyone may report a published page. It goes to the site owner, who decides. */
  app.post("/p/:slug/report", async (c) => {
    const r = await publicRow(c, c.req.param("slug"));
    if (!r || r.visibility === "private") throw new HttpError(404, "Page not found");
    const b = await readJson<{ reason?: unknown; details?: unknown; contact?: unknown; website?: unknown; turnstile?: unknown }>(c);
    if (typeof b.website === "string" && b.website !== "") return c.json({ ok: true }); // a bot filled the hidden field
    if (!(await verifyTurnstile(c, b.turnstile))) throw new HttpError(403, "We could not confirm you are a person. Please try again.");
    const reason = (REASONS as readonly string[]).includes(String(b.reason)) ? (b.reason as (typeof REASONS)[number]) : null;
    if (!reason) throw new HttpError(400, "Choose what is wrong with the page");
    const tidy = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "");
    const details = tidy(b.details, 600);
    const contact = tidy(b.contact, 120);
    if (reason === "other" && !details) throw new HttpError(400, "Please say a little about what is wrong");

    const ip = await ipOf(c);
    await throttle(c, `rep:${ip}`, 3600, 5);
    await throttle(c, `repp:${r.id}`, 86_400, 20);
    await c.env.DB.prepare("INSERT INTO reports (id, page_id, slug, reason, details, contact, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(`rp_${randomHex(8)}`, r.id, r.slug, reason, details || null, contact || null, ip, iso()).run();
    const count = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE page_id = ? AND status = 'open'").bind(r.id).first<{ n: number }>())?.n ?? 1;
    await notifyReport(c.env, deps, { origin: originOf(c), slug: r.slug!, title: r.title, reason, details, contact, count });
    // The owner hears about it once, on the first open report, so a pile-on cannot fill their inbox.
    if (count === 1) await notifyOwnerReported(c.env, deps, { ownerId: r.owner_id, title: r.title, slug: r.slug!, reason, origin: originOf(c), contactEmail: contactAddress(c.env) });
    return c.json({ ok: true });
  });

  /** Delete the account and everything in it. The person must type DELETE, so a stray tap does nothing. */
  app.delete("/me", async (c) => {
    const userId = await need(c);
    const b = await readJson<{ confirm?: unknown }>(c);
    if (typeof b.confirm !== "string" || b.confirm.trim().toUpperCase() !== "DELETE") throw new HttpError(400, "Type DELETE to confirm");
    const gone = await eraseUser(c.env, userId);
    // Also remove the login itself when the server may (Clerk). If not, the person can do it from their profile.
    let loginRemoved = false;
    const secret = c.env.CLERK_SECRET_KEY?.trim();
    if (secret && !userId.startsWith("dev_")) {
      try {
        const res = await deps.fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers: { authorization: `Bearer ${secret}` } });
        loginRemoved = res.ok;
      } catch {
        loginRemoved = false;
      }
    }
    return c.json({ ok: true, ...gone, loginRemoved });
  });

  /* ------------------------------ email ------------------------------ */

  const originOf = (c: Ctx) => (c.env.PUBLIC_URL?.trim().replace(/\/+$/, "") || new URL(c.req.url).origin);

  interface DeliveryRow { id: string; to_email: string; to_name: string | null; from_name: string; note: string | null; send_at: string; status: string; error: string | null; sent_at: string | null }
  const toDelivery = (d: DeliveryRow) => ({ id: d.id, toEmail: d.to_email, toName: d.to_name ?? "", fromName: d.from_name, note: d.note ?? "", sendAt: d.send_at, status: d.status, error: d.error ?? undefined, sentAt: d.sent_at ?? undefined });

  /** Is email switched on? Lets the website say so instead of failing. */
  app.get("/mail/status", (c) => c.json({ email: !!mailConfig(c.env), reminders: remindersOn(c.env), dailyLimit: DAILY_CAP }));

  app.get("/pages/:id/deliveries", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.param("id"), userId);
    const { results } = await c.env.DB.prepare("SELECT id, to_email, to_name, from_name, note, send_at, status, error, sent_at FROM deliveries WHERE page_id = ? ORDER BY send_at DESC LIMIT 20").bind(row.id).all<DeliveryRow>();
    return c.json({ deliveries: (results ?? []).map(toDelivery) });
  });

  app.post("/pages/:id/deliveries", async (c) => {
    const userId = await need(c);
    if (!mailConfig(c.env)) throw new HttpError(503, "Email is not switched on yet");
    const row = await ownedPage(c, c.req.param("id"), userId);
    if (row.status !== "published" || !row.slug) throw new HttpError(409, "Publish the page first, then you can email it");
    const b = await readJson<{ toEmail?: unknown; toName?: unknown; fromName?: unknown; note?: unknown; sendAt?: unknown }>(c);

    const toEmail = cleanEmail(b.toEmail);
    if (!toEmail) throw new HttpError(400, "That email address does not look right");
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "");
    const fromName = text(b.fromName, 60);
    if (!fromName) throw new HttpError(400, "Add your name, so they know who it is from");
    const toName = text(b.toName, 60);
    const note = text(b.note, 300);

    const now = deps.now();
    let sendAt = now;
    if (b.sendAt !== undefined && b.sendAt !== null && b.sendAt !== "") {
      if (typeof b.sendAt !== "string" || Number.isNaN(Date.parse(b.sendAt))) throw new HttpError(400, "That date is not valid");
      sendAt = Math.max(now, Date.parse(b.sendAt));
    }
    if (sendAt > now + 366 * 86_400_000) throw new HttpError(400, "Pick a date within the next year");
    if (row.expires_at && sendAt >= Date.parse(row.expires_at)) throw new HttpError(400, "The page ends before that time, so they could not open it");
    if (await isBlocked(c.env, toEmail)) throw new HttpError(400, "This person has asked not to get emails from MadeForYou");

    const day = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM deliveries WHERE owner_id = ? AND created_at > ?").bind(userId, new Date(now - 86_400_000).toISOString()).first<{ n: number }>();
    if ((day?.n ?? 0) >= 10) throw new HttpError(429, "You can schedule up to 10 emails a day. Try again tomorrow.");
    const active = await c.env.DB.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN to_email = ? AND status IN ('scheduled', 'sending') THEN 1 ELSE 0 END) AS same FROM deliveries WHERE page_id = ? AND status IN ('scheduled', 'sending', 'sent')").bind(toEmail, row.id).first<{ n: number; same: number | null }>();
    if ((active?.n ?? 0) >= 5) throw new HttpError(409, "One page can be emailed to up to 5 people");
    if ((active?.same ?? 0) > 0) throw new HttpError(409, "That person is already waiting for this page");

    const id = `dl_${randomHex(8)}`;
    await c.env.DB.prepare("INSERT INTO deliveries (id, page_id, owner_id, to_email, to_name, from_name, note, send_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, row.id, userId, toEmail, toName || null, fromName, note || null, new Date(sendAt).toISOString(), iso()).run();
    if (sendAt <= now + 60_000) await deliverOne(c.env, deps, originOf(c), id);
    const saved = await c.env.DB.prepare("SELECT id, to_email, to_name, from_name, note, send_at, status, error, sent_at FROM deliveries WHERE id = ?").bind(id).first<DeliveryRow>();
    return c.json({ delivery: toDelivery(saved!) });
  });

  /** Cancels one that is still waiting; removes the record of one that is done. */
  app.delete("/deliveries/:id", async (c) => {
    const userId = await need(c);
    const id = c.req.param("id");
    const d = await c.env.DB.prepare("SELECT id, status FROM deliveries WHERE id = ? AND owner_id = ?").bind(id, userId).first<{ id: string; status: string }>();
    if (!d) throw new HttpError(404, "Not found");
    if (d.status === "scheduled") await c.env.DB.prepare("UPDATE deliveries SET status = 'cancelled' WHERE id = ? AND status = 'scheduled'").bind(id).run();
    else if (d.status === "sending") throw new HttpError(409, "It is being sent right now");
    else await c.env.DB.prepare("DELETE FROM deliveries WHERE id = ?").bind(id).run();
    return c.json({ ok: true });
  });

  /** The page that "Stop emails like this" opens. Asks first, so a mail scanner that opens links cannot unsubscribe anyone. */
  const unsubHtml = (title: string, body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title></head><body style="margin:0;background:#FFF8F0;font-family:Helvetica,Arial,sans-serif;color:#4A0E1F"><main style="max-width:420px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #F3DCCB;border-radius:20px"><h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 14px">${escHtml(title)}</h1>${body}</main></body></html>`;

  const lockedDown = (c: Ctx) => {
    c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
  };
  app.get("/mail/unsub", async (c) => {
    lockedDown(c);
    const t = c.req.query("t") ?? "";
    const email = await readUnsub(c.env, t, deps.now());
    if (!email) return c.html(unsubHtml("This link is not valid", "<p>It may have expired. If you keep getting emails you do not want, reply to one of them.</p>"), 400);
    return c.html(unsubHtml("Stop emails from MadeForYou?", `<p>${escHtml(email)} will not get any more emails sent through MadeForYou.</p><form method="post" action="/api/mail/unsub?t=${encodeURIComponent(t)}"><button type="submit" style="background:#E11D48;color:#fff;border:0;border-radius:999px;padding:12px 24px;font-size:16px;font-weight:600">Yes, stop them</button></form>`));
  });
  // Also the target of the one-click unsubscribe button some mail apps show.
  app.post("/mail/unsub", async (c) => {
    lockedDown(c);
    const email = await readUnsub(c.env, c.req.query("t"), deps.now());
    if (!email) return c.html(unsubHtml("This link is not valid", "<p>It may have expired.</p>"), 400);
    await blockEmail(c.env, email, deps.now());
    return c.html(unsubHtml("Done", `<p>${escHtml(email)} will not get any more emails sent through MadeForYou.</p>`));
  });

  /** Called every 15 minutes by the scheduler Worker (apps/mailer). Not for browsers. */
  app.post("/cron/tick", async (c) => {
    const secret = c.env.CRON_SECRET?.trim();
    if (!secret) throw new HttpError(503, "The scheduler is not set up");
    const m = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i);
    if (!m || !timingSafeEqual(m[1]!.trim(), secret)) throw new HttpError(401, "Not allowed");
    let cleaned: unknown;
    try {
      cleaned = await purgeOld(c.env, deps.now());
    } catch (e) {
      console.error("clean-up failed", e); // a problem here must never hold back the emails
      cleaned = { error: true };
    }
    return c.json({ ...(await runTick(c.env, deps, originOf(c))), cleaned });
  });

  /* ------------------------------ the owner's inbox ------------------------------ */

  interface SubRow { id: string; page_id: string; block_id: string; kind: string; payload: string; status: string; source: string; read_at: string | null; created_at: string }
  const toSub = (s: SubRow) => ({ id: s.id, pageId: s.page_id, blockId: s.block_id, kind: s.kind, payload: JSON.parse(s.payload), status: s.status, source: s.source, read: !!s.read_at, createdAt: s.created_at });

  app.get("/me/inbox", async (c) => {
    const userId = await need(c);
    const row = await ownedPage(c, c.req.query("page") ?? "", userId);
    const { results } = await c.env.DB.prepare("SELECT * FROM submissions WHERE page_id = ? ORDER BY created_at DESC LIMIT 500").bind(row.id).all<SubRow>();
    return c.json({ submissions: (results ?? []).map(toSub) });
  });

  app.get("/me/inbox/summary", async (c) => {
    const userId = await need(c);
    const { results } = await c.env.DB.prepare(
      `SELECT s.page_id AS page_id,
              SUM(CASE WHEN s.kind = 'wish' AND s.status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN s.kind = 'reply' AND s.read_at IS NULL THEN 1 ELSE 0 END) AS unread,
              SUM(CASE WHEN s.kind = 'rsvp' AND json_extract(s.payload, '$.response') = 'yes' THEN 1 ELSE 0 END) AS yes,
              SUM(CASE WHEN s.kind = 'rsvp' AND json_extract(s.payload, '$.response') = 'no' THEN 1 ELSE 0 END) AS no,
              SUM(CASE WHEN s.kind = 'rsvp' AND json_extract(s.payload, '$.response') = 'maybe' THEN 1 ELSE 0 END) AS maybe,
              COALESCE(SUM(CASE WHEN s.kind = 'rsvp' THEN json_extract(s.payload, '$.guests') ELSE 0 END), 0) AS guests
       FROM submissions s JOIN pages p ON p.id = s.page_id
       WHERE p.owner_id = ? AND p.deleted_at IS NULL GROUP BY s.page_id`,
    ).bind(userId).all<{ page_id: string; pending: number; unread: number; yes: number; no: number; maybe: number; guests: number }>();
    return c.json({ pages: Object.fromEntries((results ?? []).map((r) => [r.page_id, { pending: r.pending, unread: r.unread, yes: r.yes, no: r.no, maybe: r.maybe, guests: r.guests }])) });
  });

  const ownedSubmission = async (c: Ctx, id: string, userId: string) => {
    const row = await c.env.DB.prepare("SELECT s.id FROM submissions s JOIN pages p ON p.id = s.page_id WHERE s.id = ? AND p.owner_id = ?").bind(id, userId).first<{ id: string }>();
    if (!row) throw new HttpError(404, "Message not found");
  };

  app.patch("/submissions/:id", async (c) => {
    const userId = await need(c);
    const id = c.req.param("id");
    await ownedSubmission(c, id, userId);
    const b = await readJson<{ status?: unknown; read?: unknown }>(c);
    if (b.status !== undefined) {
      if (b.status !== "approved" && b.status !== "rejected" && b.status !== "pending") throw new HttpError(400, "Unknown status");
      await c.env.DB.prepare("UPDATE submissions SET status = ? WHERE id = ?").bind(b.status, id).run();
    }
    if (b.read !== undefined) await c.env.DB.prepare("UPDATE submissions SET read_at = ? WHERE id = ?").bind(b.read ? iso() : null, id).run();
    return c.json({ ok: true });
  });

  app.delete("/submissions/:id", async (c) => {
    const userId = await need(c);
    await ownedSubmission(c, c.req.param("id"), userId);
    await c.env.DB.prepare("DELETE FROM submissions WHERE id = ?").bind(c.req.param("id")).run();
    return c.json({ ok: true });
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

    const existing = await c.env.DB.prepare("SELECT owner_id, status FROM templates WHERE id = ?").bind(id).first<{ owner_id: string; status: string }>();
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
      // Saving again must not undo the site owner's decision to reject it.
      if (existing?.status === "rejected") status = "rejected";
    }
    const fromPage = typeof body.fromPage === "string" && PAGE_ID.test(body.fromPage) ? body.fromPage : null;
    await c.env.DB.prepare(
      "INSERT INTO templates (id, owner_id, meta, content, visibility, status, from_page, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET meta = excluded.meta, content = excluded.content, visibility = excluded.visibility, status = excluded.status WHERE templates.owner_id = excluded.owner_id",
    ).bind(id, userId, JSON.stringify(meta), JSON.stringify(content), meta.visibility, status, fromPage, iso()).run();
    return c.json({ id, status });
  });

  app.delete("/templates/:id", async (c) => {
    const userId = await need(c);
    await c.env.DB.prepare("DELETE FROM templates WHERE id = ? AND owner_id = ?").bind(c.req.param("id"), userId).run();
    return c.json({ ok: true });
  });

  /** The site owner's door. Wrong guesses are counted per visitor, so the token cannot be guessed by trying again and again. */
  const admin = async (c: Ctx) => {
    const t = c.req.header("x-admin-token") ?? "";
    const key = `adm:${await ipOf(c)}`;
    await throttle(c, key, 600, 10, false);
    if (!c.env.ADMIN_TOKEN || !timingSafeEqual(t, c.env.ADMIN_TOKEN)) {
      await c.env.DB.prepare("INSERT INTO throttle (key, at) VALUES (?, ?)").bind(key, deps.now()).run();
      throw new HttpError(403, "Not allowed");
    }
  };
  app.post("/admin/templates/:id/:action", async (c) => {
    await admin(c);
    const action = c.req.param("action");
    if (action !== "approve" && action !== "reject") throw new HttpError(400, "Unknown action");
    const r = await c.env.DB.prepare("UPDATE templates SET status = ? WHERE id = ?").bind(action === "approve" ? "approved" : "rejected", c.req.param("id")).run();
    return c.json({ ok: true, changed: r.meta?.changes ?? 0 });
  });
  /** A quick look at how full the free database is. */
  app.get("/admin/usage", async (c) => {
    await admin(c);
    const one = async (q: string) => (await c.env.DB.prepare(q).first<{ n: number }>())?.n ?? 0;
    return c.json({
      users: await one("SELECT COUNT(*) AS n FROM users"),
      pages: await one("SELECT COUNT(*) AS n FROM pages WHERE deleted_at IS NULL"),
      published: await one("SELECT COUNT(*) AS n FROM pages WHERE status = 'published' AND deleted_at IS NULL"),
      photos: await one("SELECT COUNT(*) AS n FROM assets"),
      photoMegabytes: Math.round((await one("SELECT COALESCE(SUM(bytes), 0) AS n FROM assets")) / 1024 / 1024 * 10) / 10,
      storage: c.env.FILES ? "r2" : "database (free limit 500 MB in total)",
    });
  });
  /** Reports waiting for a decision, grouped by page. */
  app.get("/admin/reports", async (c) => {
    await admin(c);
    const status = c.req.query("status") === "all" ? "all" : "open";
    const { results } = await c.env.DB.prepare(
      `SELECT r.id, r.page_id, r.slug, r.reason, r.details, r.contact, r.status, r.created_at, p.title, p.owner_id, p.status AS page_status, p.taken_down_at,
              (SELECT COUNT(*) FROM reports x WHERE x.page_id = r.page_id AND x.status = 'open') AS open_for_page
         FROM reports r JOIN pages p ON p.id = r.page_id
        ${status === "open" ? "WHERE r.status = 'open'" : ""}
        ORDER BY r.created_at DESC LIMIT 100`,
    ).all();
    return c.json({ reports: results ?? [] });
  });

  /** remove: take the page down (its owner cannot publish it again) and close every open report on it. dismiss: nothing wrong. */
  app.post("/admin/reports/:id/:action", async (c) => {
    await admin(c);
    const action = c.req.param("action");
    if (action !== "remove" && action !== "dismiss") throw new HttpError(400, "Unknown action");
    const rep = await c.env.DB.prepare("SELECT id, page_id, reason, status FROM reports WHERE id = ?").bind(c.req.param("id")).first<{ id: string; page_id: string; reason: string; status: string }>();
    if (!rep) throw new HttpError(404, "Report not found");
    const body = await readJson<{ note?: unknown }>(c).catch(() => ({}) as { note?: unknown });
    const note = typeof body.note === "string" ? body.note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 600) : "";
    const pageRow = await c.env.DB.prepare("SELECT title, slug, owner_id FROM pages WHERE id = ?").bind(rep.page_id).first<{ title: string; slug: string | null; owner_id: string }>();
    // Who to write to: the reporter of this report, or every reporter whose open report this takes care of.
    const who = action === "dismiss"
      ? ((await c.env.DB.prepare("SELECT contact FROM reports WHERE id = ?").bind(rep.id).all<{ contact: string | null }>()).results ?? [])
      : ((await c.env.DB.prepare("SELECT contact FROM reports WHERE page_id = ? AND status = 'open'").bind(rep.page_id).all<{ contact: string | null }>()).results ?? []);
    const slug = pageRow?.slug ?? (await c.env.DB.prepare("SELECT slug FROM reports WHERE id = ?").bind(rep.id).first<{ slug: string | null }>())?.slug ?? "";
    if (action === "dismiss") {
      await c.env.DB.prepare("UPDATE reports SET status = 'dismissed', handled_at = ? WHERE id = ?").bind(iso(), rep.id).run();
    } else {
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE pages SET status = 'draft', taken_down_at = ?, takedown_reason = ?, updated_at = ? WHERE id = ?").bind(iso(), note ? `Reported: ${rep.reason}. ${note}` : `Reported: ${rep.reason}`, iso(), rep.page_id),
        c.env.DB.prepare("UPDATE reports SET status = 'removed', handled_at = ? WHERE page_id = ? AND status = 'open'").bind(iso(), rep.page_id),
      ]);
    }
    if (pageRow && rep.status === "open") {
      await notifyDecision(c.env, deps, {
        decision: action === "remove" ? "removed" : "dismissed", note, title: pageRow.title, slug, ownerId: pageRow.owner_id,
        origin: originOf(c), contactEmail: contactAddress(c.env), reporters: who.map((w) => w.contact),
      });
    }
    return c.json({ ok: true });
  });

  /** Let a page owner publish again after a mistake. */
  app.post("/admin/pages/:id/restore", async (c) => {
    await admin(c);
    const r = await c.env.DB.prepare("UPDATE pages SET taken_down_at = NULL, takedown_reason = NULL, updated_at = ? WHERE id = ?").bind(iso(), c.req.param("id")).run();
    return c.json({ ok: true, changed: r.meta?.changes ?? 0 });
  });

  app.get("/admin/templates/pending", async (c) => {
    await admin(c);
    const { results } = await c.env.DB.prepare("SELECT id, owner_id, meta, created_at FROM templates WHERE status = 'pending' ORDER BY created_at").all();
    return c.json({ pending: results ?? [] });
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
