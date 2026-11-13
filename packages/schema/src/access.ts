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

/* ---------- guest messages ---------- */
export const SUBMISSION = {
  /** Which block type accepts which kind of message. */
  blockKind: { wishes: "wish", replyBox: "reply", rsvp: "rsvp" } as const,
  perPagePerHour: 40,
  perVisitorPer10Min: 5,
  maxPerPage: 400,
  minFillMs: 1500,
} as const;
export type SubmissionKind = "wish" | "reply" | "rsvp";

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+\n/g, "\n").trim().slice(0, max) : "";

/** A plain, sane email address in lower case, or null. Deliberately strict: no names, quotes, commas or line breaks. */
export function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  return /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(e) ? e : null;
}

/** Checks and tidies a guest's message. Returns the cleaned payload, or an error in plain words. */
export function cleanSubmission(kind: SubmissionKind, raw: unknown): { ok: true; payload: Record<string, string | number> } | { ok: false; error: string } {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (kind === "wish") {
    const name = clean(p.name, 60), message = clean(p.message, 500);
    if (!name) return { ok: false, error: "Please add your name" };
    if (!message) return { ok: false, error: "Please write your wish" };
    return { ok: true, payload: { name, message } };
  }
  if (kind === "reply") {
    const message = clean(p.message, 1000), name = clean(p.name, 60);
    if (!message) return { ok: false, error: "Please write a message" };
    return { ok: true, payload: name ? { name, message } : { message } };
  }
  const name = clean(p.name, 60), note = clean(p.note, 200);
  const response = p.response === "yes" || p.response === "no" || p.response === "maybe" ? p.response : "";
  if (!name) return { ok: false, error: "Please add your name" };
  if (!response) return { ok: false, error: "Please choose Yes, No or Maybe" };
  const guests = response === "no" ? 0 : Math.min(10, Math.max(1, Math.floor(Number(p.guests) || 1)));
  const payload: Record<string, string | number> = { name, response, guests };
  if (note) payload.note = note;
  // An optional address for ONE reminder before the event. Never kept for someone who said no.
  const rawEmail = typeof p.email === "string" ? p.email.trim() : "";
  if (rawEmail && response !== "no") {
    const email = cleanEmail(rawEmail);
    if (!email) return { ok: false, error: "That email address does not look right" };
    payload.email = email;
  }
  return { ok: true, payload };
}
