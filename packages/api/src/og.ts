import { gateState, type Content } from "@madeforyou/schema";
import { signToken } from "./crypto";

export interface OgMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const GENERIC = { title: "Something is waiting for you", description: "A page made just for you, with love." };

interface Row {
  id: string; title: string; content: string; visibility: string; password_hash: string | null; unlock_at: string | null; expires_at: string | null;
}

export async function pageMeta(row: Row | null, origin: string, slug: string, secret: string, now: number): Promise<OgMeta> {
  const base = { ...GENERIC, image: `${origin}/og-default.png`, url: `${origin}/p/${slug}` };
  if (!row || row.visibility === "private") return base;
  const state = gateState({ unlockAt: row.unlock_at, expiresAt: row.expires_at, hasPassword: !!row.password_hash }, now);
  if (state !== "open") return base;

  const content = JSON.parse(row.content) as Content;
  const hero = content.blocks.find((b) => b.type === "hero");
  const recipient = hero && !hero.ph.includes("recipient") && typeof hero.fields.recipient === "string" ? hero.fields.recipient.trim() : "";
  const cover = hero && !hero.ph.includes("cover") ? (hero.fields.cover as { asset?: string } | null) : null;
  const image = cover?.asset
    ? `${origin}/api/a/${cover.asset}?t=${encodeURIComponent(await signToken(secret, `pg:${row.id}`, 7 * 86400, now))}`
    : base.image;
  return { title: row.title, description: `A page made just for ${recipient || "you"}`, image, url: base.url };
}

export const META_MARKER = "<!--mfy-meta-->";

export function injectMeta(html: string, m: OgMeta): string {
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="MadeForYou">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:image" content="${esc(m.image)}">`,
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="description" content="${esc(m.description)}">`,
  ].join("\n    ");
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`).replace(META_MARKER, tags);
}
