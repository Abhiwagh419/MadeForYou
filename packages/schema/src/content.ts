import { z } from "zod";
import { migrateBlock } from "./migrate";
import { blockFieldsSchema, registry } from "./registry";

export const MAX_BLOCKS = 40;
export const MAX_JSON_CHARS = 200_000;

export const SettingsSchema = z
  .object({
    opening: z
      .object({
        kind: z.enum(["none", "envelope", "giftbox", "curtain", "diary"]).default("none"),
        text: z.string().max(60).optional(),
      })
      .prefault({}),
    theme: z.object({ preset: z.string().max(40).default("rose-garden") }).prefault({}),
    // What happens where the visitor taps the page. Off by default: not every page is a happy one.
    tap: z.enum(["none", "hearts", "sparkles"]).default("none"),
    ambience: z
      .object({
        kind: z.enum(["none", "petals", "diyas", "stars", "confetti"]).default("none"),
        intensity: z.enum(["low", "medium"]).default("low"),
      })
      .prefault({}),
    languages: z
      .object({
        default: z.string().min(2).max(8).default("en"),
        available: z.array(z.string().min(2).max(8)).max(8).default(["en"]),
      })
      .prefault({}),
    // Embeds are stored as provider + id, never as raw URLs.
    music: z
      .object({
        provider: z.enum(["youtube", "spotify"]),
        id: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, "Invalid media id"),
      })
      .optional(),
  })
  .prefault({});

export const StyleSchema = z.object({
  align: z.enum(["left", "center", "right"]).default("center"),
  space: z.enum(["sm", "md", "lg"]).default("md"),
  // Revealed as the block scrolls into view. Motion is opt-in per block.
  anim: z.enum(["none", "fade", "fade-up", "zoom"]).default("none"),
  bg: z.enum(["default", "soft", "accent"]).default("default"),
});

export const BlockSchema = z.object({
  id: z.string().regex(/^blk_[A-Za-z0-9_-]{3,24}$/),
  type: z.string().min(1).max(40),
  v: z.number().int().positive(),
  fields: z.record(z.string(), z.unknown()),
  /** Names of fields that still hold placeholder (sample) content. */
  ph: z.array(z.string()).default([]),
  style: StyleSchema.prefault({}),
  visible: z.boolean().default(true),
  /** Second-language text: i18n[lang][fieldName]. The common single-language page never needs it. */
  i18n: z.record(z.string(), z.record(z.string(), z.string().max(5000))).optional(),
});

export const ContentSchema = z.object({
  schemaVersion: z.literal(1),
  settings: SettingsSchema,
  blocks: z.array(BlockSchema).max(MAX_BLOCKS),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type Style = z.infer<typeof StyleSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type Content = z.infer<typeof ContentSchema>;

export interface Issue {
  path: string;
  message: string;
}
export type ValidationResult = { ok: true; content: Content } | { ok: false; issues: Issue[] };

/**
 * The single validation gate. Run it on the client before saving and again on the
 * server before storing. Unknown block types are rejected, unknown fields dropped.
 */
export function validateContent(input: unknown): ValidationResult {
  let size = 0;
  try {
    size = JSON.stringify(input).length;
  } catch {
    return { ok: false, issues: [{ path: "", message: "Content is not valid JSON" }] };
  }
  if (size > MAX_JSON_CHARS) {
    return { ok: false, issues: [{ path: "", message: `Content is too large (limit ${MAX_JSON_CHARS} characters)` }] };
  }

  const envelope = ContentSchema.safeParse(input);
  if (!envelope.success) {
    return {
      ok: false,
      issues: envelope.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }

  const issues: Issue[] = [];
  const seen = new Set<string>();
  const blocks: Block[] = [];

  envelope.data.blocks.forEach((raw, i) => {
    const base = `blocks.${i}`;
    if (seen.has(raw.id)) issues.push({ path: `${base}.id`, message: `Duplicate block id "${raw.id}"` });
    seen.add(raw.id);

    const def = registry[raw.type];
    if (!def) {
      issues.push({ path: `${base}.type`, message: `Unknown block type "${raw.type}"` });
      return;
    }
    if (raw.v > def.version) {
      issues.push({ path: `${base}.v`, message: `Block version ${raw.v} is newer than supported (${def.version})` });
      return;
    }

    let block: Block;
    try {
      block = migrateBlock(raw);
    } catch (e) {
      issues.push({ path: `${base}.v`, message: (e as Error).message });
      return;
    }

    const parsed = blockFieldsSchema(def).safeParse(block.fields);
    if (!parsed.success) {
      parsed.error.issues.forEach((is) =>
        issues.push({ path: `${base}.fields.${is.path.join(".")}`, message: is.message }),
      );
      return;
    }

    for (const name of block.ph) {
      if (!(name in def.fields)) issues.push({ path: `${base}.ph`, message: `Unknown field "${name}" in ph` });
    }
    for (const [lang, entries] of Object.entries(block.i18n ?? {})) {
      for (const name of Object.keys(entries)) {
        const k = def.fields[name]?.kind;
        if (k !== "text" && k !== "longtext") {
          issues.push({ path: `${base}.i18n.${lang}.${name}`, message: `"${name}" cannot be translated` });
        }
      }
    }

    blocks.push({ ...block, fields: parsed.data as Record<string, unknown> });
  });

  if (issues.length) return { ok: false, issues };
  return { ok: true, content: { ...envelope.data, blocks } };
}
