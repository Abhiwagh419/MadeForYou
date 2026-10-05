import type { Content } from "./content";

/* ---------- limits shared by the browser and the server ---------- */
export const LIMITS = {
  pagesPerUser: 30,
  assetBytes: 1.5 * 1024 * 1024, // photos are shrunk in the browser first, so they are usually 150-400 KB; D1 allows 2 MB per row
  userBytes: 25 * 1024 * 1024,
  titleChars: 60,
} as const;

/* ---------- links ---------- */
const RESERVED = new Set(["admin", "api", "app", "edit", "new", "me", "p", "t", "www", "about", "help", "login", "make", "publish", "share", "templates", "home", "assets", "a"]);
export type SlugStatus = "ok" | "short" | "invalid" | "reserved" | "taken";

export function slugStatus(slug: string, isTaken: (s: string) => boolean): SlugStatus {
  if (slug.length < 3) return "short";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 30) return "invalid";
  if (RESERVED.has(slug)) return "reserved";
  return isTaken(slug) ? "taken" : "ok";
}

/* ---------- assets ---------- */
const ASSET_RE = /ast_[A-Za-z0-9_-]{4,64}/g;
export const isAssetId = (s: string) => /^ast_[A-Za-z0-9_-]{4,64}$/.test(s);

/** Every asset id a page refers to. */
export function assetIds(content: Content): string[] {
  return [...new Set(JSON.stringify(content).match(ASSET_RE) ?? [])];
}

/* ---------- who may see a page, and when ---------- */
export interface AccessInfo {
  unlockAt?: string | null;
  expiresAt?: string | null;
  hasPassword: boolean;
}
export type GateState = "ended" | "locked" | "password" | "open";

/**
 * The single rule for a visitor: ended beats locked beats password beats open.
 * The server uses it to decide whether to send content at all; the browser uses it only to
 * choose which screen to show.
 */
export function gateState(a: AccessInfo, now: number = Date.now()): GateState {
  if (a.expiresAt && Date.parse(a.expiresAt) <= now) return "ended";
  if (a.unlockAt && Date.parse(a.unlockAt) > now) return "locked";
  return a.hasPassword ? "password" : "open";
}
