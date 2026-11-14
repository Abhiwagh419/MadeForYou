import type { Env } from "./types";

/* =============================================================================================
 * Deleting data. Two situations:
 *   - a person deletes their account: everything of theirs goes at once (eraseUser)
 *   - a deleted page, or a photo no page uses, is kept for 30 days in case of a mistake, then goes (purgeOld)
 * ============================================================================================= */

export const KEEP_DELETED_DAYS = 30;
export const KEEP_REPORT_DAYS = 365;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Removes photo files from R2 when a bucket is bound. Photos kept in the database go with their rows. */
async function dropFiles(env: Env, ids: string[]) {
  if (!env.FILES || !ids.length) return;
  for (let i = 0; i < ids.length; i += 100) {
    try {
      await env.FILES.delete(ids.slice(i, i + 100).map((id) => `a/${id}`));
    } catch {
      /* a file that is already gone is fine */
    }
  }
}

/** Everything a person has: pages, photos, guest messages, scheduled emails, templates and the account itself. */
export async function eraseUser(env: Env, userId: string): Promise<{ pages: number; photos: number }> {
  const photos = ((await env.DB.prepare("SELECT id FROM assets WHERE owner_id = ?").bind(userId).all<{ id: string }>()).results ?? []).map((a) => a.id);
  const pages = (await env.DB.prepare("SELECT COUNT(*) AS n FROM pages WHERE owner_id = ?").bind(userId).first<{ n: number }>())?.n ?? 0;
  await dropFiles(env, photos);
  const mine = "(SELECT id FROM pages WHERE owner_id = ?)";
  const q = (sql: string) => env.DB.prepare(sql).bind(userId);
  await env.DB.batch([
    q(`DELETE FROM submissions WHERE page_id IN ${mine}`),
    q(`DELETE FROM deliveries WHERE owner_id = ? OR page_id IN ${mine}`).bind(userId, userId),
    q(`DELETE FROM reports WHERE page_id IN ${mine}`),
    q(`DELETE FROM page_assets WHERE page_id IN ${mine}`),
    q("DELETE FROM asset_blobs WHERE id IN (SELECT id FROM assets WHERE owner_id = ?)"),
    q("DELETE FROM assets WHERE owner_id = ?"),
    q("DELETE FROM templates WHERE owner_id = ?"),
    q("DELETE FROM pages WHERE owner_id = ?"),
    q("DELETE FROM users WHERE id = ?"),
  ]);
  return { pages, photos: photos.length };
}

/** Page ids and photo ids whose time has come. Small batches, so one run never takes long. */
export async function purgeOld(env: Env, now: number): Promise<{ pages: number; photos: number; reports: number }> {
  const cutoff = iso(now - KEEP_DELETED_DAYS * DAY);
  let pageCount = 0;
  const old = ((await env.DB.prepare("SELECT id FROM pages WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 25").bind(cutoff).all<{ id: string }>()).results ?? []).map((p) => p.id);
  for (const id of old) {
    const q = (sql: string) => env.DB.prepare(sql).bind(id);
    await env.DB.batch([
      q("DELETE FROM submissions WHERE page_id = ?"),
      q("DELETE FROM deliveries WHERE page_id = ?"),
      q("DELETE FROM reports WHERE page_id = ?"),
      q("DELETE FROM page_assets WHERE page_id = ?"),
      q("DELETE FROM pages WHERE id = ?"),
    ]);
    pageCount++;
  }

  // photos that no page uses any more (a deleted page, a replaced picture) after the same grace period
  const loose = ((await env.DB.prepare("SELECT id FROM assets a WHERE a.created_at < ? AND NOT EXISTS (SELECT 1 FROM page_assets p WHERE p.asset_id = a.id) LIMIT 50").bind(cutoff).all<{ id: string }>()).results ?? []).map((a) => a.id);
  await dropFiles(env, loose);
  for (const id of loose) {
    await env.DB.batch([env.DB.prepare("DELETE FROM asset_blobs WHERE id = ?").bind(id), env.DB.prepare("DELETE FROM assets WHERE id = ?").bind(id)]);
  }

  // reports that have been dealt with are not kept for ever
  const rep = await env.DB.prepare("DELETE FROM reports WHERE status != 'open' AND handled_at IS NOT NULL AND handled_at < ?").bind(iso(now - KEEP_REPORT_DAYS * DAY)).run();
  return { pages: pageCount, photos: loose.length, reports: rep.meta?.changes ?? 0 };
}
