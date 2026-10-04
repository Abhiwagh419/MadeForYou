import type { Env } from "./types";
import { injectMeta, pageMeta } from "./og";

/** The HTML for /p/:slug: the app shell with this page's preview tags (or a generic card). */
export async function renderPageShell(env: Env, shellHtml: string, origin: string, slug: string): Promise<string> {
  const clean = /^[a-z0-9-]{1,40}$/.test(slug) ? slug : "";
  const row = clean
    ? await env.DB.prepare("SELECT id, title, content, visibility, password_hash, unlock_at, expires_at FROM pages WHERE slug = ? AND status = 'published' AND deleted_at IS NULL").bind(clean).first<{
        id: string; title: string; content: string; visibility: string; password_hash: string | null; unlock_at: string | null; expires_at: string | null;
      }>()
    : null;
  return injectMeta(shellHtml, await pageMeta(row, origin, clean, env.SESSION_SECRET, Date.now()));
}
