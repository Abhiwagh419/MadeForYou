import type { Content } from "./content";
import { placeholderValue } from "./fields";
import { registry } from "./registry";

export interface StripOptions {
  keep?: Record<string, string[]>;
}
export interface StripEntry {
  blockId: string;
  type: string;
  field: string;
  action: "stripped" | "kept";
}

export function stripPersonal(content: Content, opts: StripOptions = {}): { content: Content; report: StripEntry[] } {
  const report: StripEntry[] = [];

  const blocks = content.blocks.map((block) => {
    const def = registry[block.type];
    if (!def) throw new Error(`Unknown block type "${block.type}"`);

    const fields: Record<string, unknown> = { ...block.fields };
    const ph = new Set(block.ph);
    const i18n = block.i18n ? structuredClone(block.i18n) : undefined;

    for (const [name, fdef] of Object.entries(def.fields)) {
      if (!fdef.personal) continue;
      if (opts.keep?.[block.id]?.includes(name)) {
        report.push({ blockId: block.id, type: block.type, field: name, action: "kept" });
        ph.delete(name);
        continue;
      }
      fields[name] = placeholderValue(fdef);
      ph.add(name);
      if (i18n) for (const lang of Object.keys(i18n)) delete i18n[lang]?.[name];
      report.push({ blockId: block.id, type: block.type, field: name, action: "stripped" });
    }

    const cleanI18n = i18n
      ? Object.fromEntries(Object.entries(i18n).filter(([, v]) => Object.keys(v).length > 0))
      : undefined;

    return {
      ...block,
      fields,
      ph: [...ph],
      ...(cleanI18n && Object.keys(cleanI18n).length ? { i18n: cleanI18n } : { i18n: undefined }),
    };
  });

  const { music, ...settings } = content.settings;
  if (music) report.push({ blockId: "settings", type: "settings", field: "music", action: "stripped" });

  return { content: { ...content, settings, blocks }, report };
}

const COMMON = new Set([
  "dear", "my", "to", "hi", "hello", "love", "darling", "the", "and", "for", "with", "you", "your", "yours", "from",
  "maa", "mom", "mummy", "papa", "dad", "bhaiya", "bhai", "didi", "behen", "sir", "madam", "mam", "friend", "yaar", "favourite", "person",
]);

export function personalNames(content: Content): string[] {
  const out = new Set<string>();
  for (const b of content.blocks) {
    const def = registry[b.type];
    if (!def) continue;
    for (const [name, f] of Object.entries(def.fields)) {
      if (!f.nameLike || b.ph.includes(name)) continue;
      const v = b.fields[name];
      if (typeof v !== "string") continue;
      for (const w of v.split(/[\s,.;:!?'"“”()\-/]+/)) {
        const t = w.trim().toLowerCase();
        if (t.length >= 3 && !COMMON.has(t)) out.add(t);
      }
    }
  }
  return [...out];
}
