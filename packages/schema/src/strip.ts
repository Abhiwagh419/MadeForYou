import type { Content } from "./content";
import { placeholderValue } from "./fields";
import { registry } from "./registry";

export interface StripOptions {
  /** Fields the template author chose to keep, by block id (the "keep" toggle on the review screen). */
  keep?: Record<string, string[]>;
}
export interface StripEntry {
  blockId: string;
  type: string;
  field: string;
  action: "stripped" | "kept";
}

/**
 * "Share as template": returns a copy with every personal field reset to its
 * placeholder, plus a report for the review screen. Personal is the safe default:
 * nothing becomes public unless the author explicitly keeps it.
 */
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

  // Settings can be personal too: the chosen song is private to the page.
  const { music, ...settings } = content.settings;
  if (music) report.push({ blockId: "settings", type: "settings", field: "music", action: "stripped" });

  return { content: { ...content, settings, blocks }, report };
}
