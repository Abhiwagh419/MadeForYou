import { slugStatus, type SlugStatus } from "@madeforyou/schema";
import { isRemote } from "./config";
export { slugStatus, type SlugStatus };

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** "End message" from "endMessage". */
export const humanize = (key: string) => {
  const s = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export const SLUG_MESSAGES: Record<SlugStatus, string> = {
  ok: "This link is available",
  short: "Use at least 3 characters",
  invalid: "Use only lowercase letters, numbers and single hyphens",
  reserved: "That word is reserved, try another",
  taken: "Someone already has this link",
};
export function slugSuggestions(base: string, isTaken: (s: string) => boolean): string[] {
  const b = slugify(base) || "for-you";
  const year = new Date().getFullYear();
  return [`${b}-${year}`, `${b}-2`, `for-${b}`, `${b}-forever`].filter((s) => slugStatus(s, isTaken) === "ok").slice(0, 3);
}

/** Turns a pasted YouTube or Spotify link into provider + id. Anything else is rejected. */
export function parseMusic(input: string): { provider: "youtube" | "spotify"; id: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com") {
    const v = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(v) ? { provider: "youtube", id: v } : null;
  }
  if (host === "open.spotify.com") {
    const id = url.pathname.match(/\/track\/([A-Za-z0-9]{22})/)?.[1];
    return id ? { provider: "spotify", id } : null;
  }
  return null;
}

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function pageUrl(slug: string): string {
  const { origin, pathname } = window.location;
  return isRemote() ? `${origin}/p/${slug}` : `${origin}${pathname}#/p/${slug}`;
}

export async function sha256(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    let h = 5381;
    for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return `weak-${(h >>> 0).toString(16)}`;
  }
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function scrollToBlock(scroller: HTMLElement | null, id: string) {
  const el = scroller?.querySelector<HTMLElement>(`[id="${id}"]`);
  if (!scroller || !el) return;
  const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo?.({ top: Math.max(0, top - 24), behavior: "smooth" });
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
