import { z } from "zod";

export interface FieldTags {
  personal?: boolean;
  guided?: boolean;
  required?: boolean;
  prompt?: string;
  placeholder?: unknown;
  nameLike?: boolean;
}

export type FieldDef =
  | (FieldTags & { kind: "text"; max: number })
  | (FieldTags & { kind: "longtext"; max: number })
  | (FieldTags & { kind: "image" })
  | (FieldTags & { kind: "date"; withTime?: boolean })
  | (FieldTags & { kind: "url"; max: number })
  | (FieldTags & { kind: "embed" })
  | (FieldTags & { kind: "audio" })
  | (FieldTags & { kind: "geo" })
  | (FieldTags & { kind: "enum"; options: readonly [string, ...string[]]; default: string })
  | (FieldTags & { kind: "list"; max: number; item: Record<string, FieldDef> });

export const f = {
  text: (max: number, tags: FieldTags = {}): FieldDef => ({ kind: "text", max, ...tags }),
  longtext: (max: number, tags: FieldTags = {}): FieldDef => ({ kind: "longtext", max, ...tags }),
  image: (tags: FieldTags = {}): FieldDef => ({ kind: "image", ...tags }),
  date: (tags: FieldTags = {}, withTime = false): FieldDef => ({ kind: "date", withTime, ...tags }),
  url: (max: number, tags: FieldTags = {}): FieldDef => ({ kind: "url", max, ...tags }),
  embed: (tags: FieldTags = {}): FieldDef => ({ kind: "embed", ...tags }),
  audio: (tags: FieldTags = {}): FieldDef => ({ kind: "audio", ...tags }),
  geo: (tags: FieldTags = {}): FieldDef => ({ kind: "geo", ...tags }),
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

export const AssetRefSchema = z.object({
  asset: z.string().regex(/^ast_[A-Za-z0-9_-]{4,64}$/, "Invalid asset reference"),
  alt: z.string().max(200).optional(),
  ratio: z.number().min(0.2).max(5).optional(),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

const SAFE_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

export function isSafeLink(v: string): boolean {
  if (v === "") return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(v).protocol);
  } catch {
    return false;
  }
}

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

export const AudioRefSchema = z.object({
  asset: z.string().regex(/^ast_[A-Za-z0-9_-]{4,64}$/, "Invalid asset reference"),
  seconds: z.number().min(0).max(65).optional(),
});
export type AudioRef = z.infer<typeof AudioRefSchema>;

export const GeoSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export type Geo = z.infer<typeof GeoSchema>;

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const valid = (lat: number, lng: number): Geo | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: round5(lat), lng: round5(lng) } : null;

export function parseGeo(input: string): Geo | null {
  const v = input.trim();
  if (!v) return null;
  const pair = v.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (pair) return valid(+pair[1]!, +pair[2]!);
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  if (host === "openstreetmap.org") {
    const mlat = url.searchParams.get("mlat"), mlon = url.searchParams.get("mlon");
    if (mlat && mlon) return valid(+mlat, +mlon);
    const m = url.hash.match(new RegExp(`map=\\d+/${num}/${num}`));
    return m ? valid(+m[1]!, +m[2]!) : null;
  }
  if (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps") || host === "maps.google.com") {
    const href = decodeURIComponent(url.href);
    const at = href.match(new RegExp(`@${num},${num}`));
    if (at) return valid(+at[1]!, +at[2]!);
    const bang = href.match(new RegExp(`!3d${num}!4d${num}`));
    if (bang) return valid(+bang[1]!, +bang[2]!);
    const q = (url.searchParams.get("q") ?? url.searchParams.get("ll") ?? "").match(new RegExp(`^${num}\\s*,\\s*${num}$`));
    return q ? valid(+q[1]!, +q[2]!) : null;
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
    case "audio":
      return AudioRefSchema.nullable();
    case "geo":
      return GeoSchema.nullable();
    case "enum":
      return z.enum(def.options);
    case "list":
      return z.array(shapeToZod(def.item)).max(def.max);
  }
}

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
    case "audio":
    case "geo":
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
    case "audio":
    case "geo":
      return value == null;
    case "enum":
      return false;
    case "list":
      return !Array.isArray(value) || value.length === 0;
  }
}
