import { z } from "zod";

/**
 * The four tags every field can carry. They live in the code registry (not in
 * saved pages) and drive guided mode, template stripping and the publish check.
 */
export interface FieldTags {
  /** Removed when a page is shared as a template. Default is NOT personal, so mark user content explicitly. */
  personal?: boolean;
  /** Asked as a question in guided mode. */
  guided?: boolean;
  /** Must be filled (not left as a placeholder) before publishing. */
  required?: boolean;
  /** The guided-mode question. */
  prompt?: string;
  /** Sample value shown (greyed) until the user fills the field. */
  placeholder?: unknown;
  /** Holds a person's name. Used to stop names leaking into public template titles and tags. */
  nameLike?: boolean;
}

export type FieldDef =
  | (FieldTags & { kind: "text"; max: number })
  | (FieldTags & { kind: "longtext"; max: number })
  | (FieldTags & { kind: "image" })
  | (FieldTags & { kind: "date"; withTime?: boolean })
  | (FieldTags & { kind: "url"; max: number })
  | (FieldTags & { kind: "embed" })
  | (FieldTags & { kind: "enum"; options: readonly [string, ...string[]]; default: string })
  | (FieldTags & { kind: "list"; max: number; item: Record<string, FieldDef> });

export const f = {
  text: (max: number, tags: FieldTags = {}): FieldDef => ({ kind: "text", max, ...tags }),
  longtext: (max: number, tags: FieldTags = {}): FieldDef => ({ kind: "longtext", max, ...tags }),
  image: (tags: FieldTags = {}): FieldDef => ({ kind: "image", ...tags }),
  date: (tags: FieldTags = {}, withTime = false): FieldDef => ({ kind: "date", withTime, ...tags }),
  url: (max: number, tags: FieldTags = {}): FieldDef => ({ kind: "url", max, ...tags }),
  embed: (tags: FieldTags = {}): FieldDef => ({ kind: "embed", ...tags }),
  enum: (options: readonly [string, ...string[]], dflt: string, tags: FieldTags = {}): FieldDef => ({
    kind: "enum",
    options,
    default: dflt,
    ...tags,
  }),
  list: (max: number, item: Record<string, FieldDef>, tags: FieldTags = {}): FieldDef => ({
    kind: "list",
    max,
    item,
    ...tags,
  }),
};

/** Images and audio are stored as references, never URLs (see schema notes). */
export const AssetRefSchema = z.object({
  asset: z.string().regex(/^ast_[A-Za-z0-9_-]{4,64}$/, "Invalid asset reference"),
  alt: z.string().max(200).optional(),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

/* ---------- links and video: only safe, known shapes are ever stored ---------- */
const SAFE_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

/** "" (no link) or a link that cannot run script: https, http, mailto or tel only. */
export function isSafeLink(v: string): boolean {
  if (v === "") return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(v).protocol);
  } catch {
    return false;
  }
}

/** Turns what people type into a real link: a 10-digit number becomes tel:+91..., an email becomes mailto:, www. gets https. */
export function normalizeLink(input: string): string {
  const v = input.trim();
  if (!v) return "";
  if (/^[+]?[\d\s-]{10,15}$/.test(v)) {
    const digits = v.replace(/[\s-]/g, "");
    return `tel:${digits.startsWith("+") ? digits : digits.length === 10 ? `+91${digits}` : `+${digits}`}`;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  return `https://${v}`;
}

export const VideoSchema = z.object({ provider: z.enum(["youtube", "vimeo"]), id: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/) });
export type VideoRef = z.infer<typeof VideoSchema>;

/** A pasted YouTube or Vimeo link becomes provider + id. Anything else is refused. */
export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const yt = (id: string | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? ({ provider: "youtube", id } as VideoRef) : null);
  if (host === "youtu.be") return yt(url.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com") return yt(url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1]);
  if (host === "vimeo.com") {
    const id = url.pathname.match(/^\/(?:video\/)?(\d{6,12})/)?.[1];
    return id ? { provider: "vimeo", id } : null;
  }
  if (host === "player.vimeo.com") {
    const id = url.pathname.match(/^\/video\/(\d{6,12})/)?.[1];
    return id ? { provider: "vimeo", id } : null;
  }
  return null;
}

export function fieldToZod(def: FieldDef): z.ZodTypeAny {
  switch (def.kind) {
    case "text":
    case "longtext":
      return z.string().max(def.max);
    case "image":
      return AssetRefSchema.nullable();
    case "date":
      return z.string().regex(DATE_RE, "Use an ISO date, e.g. 2026-12-25").nullable();
    case "url":
      return z.string().max(def.max).refine(isSafeLink, "Use a web link, an email address or a phone number");
    case "embed":
      return VideoSchema.nullable();
    case "enum":
      return z.enum(def.options);
    case "list":
      return z.array(shapeToZod(def.item)).max(def.max);
  }
}

/** Unknown keys are dropped (zod's default), and every field is optional so drafts can be incomplete. */
export function shapeToZod(fields: Record<string, FieldDef>) {
  return z.object(
    Object.fromEntries(Object.entries(fields).map(([k, d]) => [k, fieldToZod(d).optional()])),
  );
}

export function defaultValue(def: FieldDef): unknown {
  switch (def.kind) {
    case "text":
    case "longtext":
    case "url":
      return "";
    case "image":
    case "date":
    case "embed":
      return null;
    case "enum":
      return def.default;
    case "list":
      return [];
  }
}

export function placeholderValue(def: FieldDef): unknown {
  return structuredClone(def.placeholder !== undefined ? def.placeholder : defaultValue(def));
}

export function isEmpty(def: FieldDef, value: unknown): boolean {
  switch (def.kind) {
    case "text":
    case "longtext":
    case "url":
      return typeof value !== "string" || value.trim() === "";
    case "image":
    case "date":
    case "embed":
      return value == null;
    case "enum":
      return false;
    case "list":
      return !Array.isArray(value) || value.length === 0;
  }
}
