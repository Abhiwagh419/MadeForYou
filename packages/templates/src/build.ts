import {
  BlockSchema, SettingsSchema, createBlock, validateTemplate,
  type Block, type Settings, type Template,
} from "@madeforyou/schema";

export interface BlockSpec {
  type: string;
  /** Sample content. Personal fields stay flagged as placeholders unless listed in `final`. */
  fields?: Record<string, unknown>;
  /** Fields whose text the template author wrote and the visitor normally keeps (e.g. the greeting). */
  final?: string[];
  style?: Partial<Block["style"]>;
  /** Hindi versions of template-authored text. */
  hi?: Record<string, string>;
}
export const block = (type: string, spec: Omit<BlockSpec, "type"> = {}): BlockSpec => ({ type, ...spec });

export interface TemplateSpec {
  id: string;
  /** Short unique prefix for block ids. */
  abbr: string;
  title: string;
  titleHi?: string;
  occasions: string[];
  relationships?: string[];
  moods?: Template["meta"]["moods"];
  tags?: string[];
  theme: string;
  opening?: string | null;
  ambience?: Settings["ambience"]["kind"];
  tap?: Settings["tap"];
  blocks: BlockSpec[];
}

export function tpl(spec: TemplateSpec): Template {
  const hasHi = spec.blocks.some((b) => b.hi) || !!spec.titleHi;
  const languages = hasHi ? ["en", "hi"] : ["en"];

  const blocks = spec.blocks.map((b, i) => {
    const base = createBlock(b.type, `blk_${spec.abbr}${i + 1}`);
    return BlockSchema.parse({
      ...base,
      fields: { ...base.fields, ...b.fields },
      ph: base.ph.filter((n) => !(b.final ?? []).includes(n)),
      style: { ...base.style, space: "lg", ...b.style },
      ...(b.hi ? { i18n: { hi: b.hi } } : {}),
    });
  });

  const settings = SettingsSchema.parse({
    opening: spec.opening ? { kind: "envelope", text: spec.opening } : { kind: "none" },
    theme: { preset: spec.theme },
    ambience: { kind: spec.ambience ?? "none", intensity: "low" },
    tap: spec.tap ?? "none",
    languages: { default: "en", available: languages },
  });

  const r = validateTemplate({
    meta: {
      id: spec.id,
      title: spec.title,
      ...(spec.titleHi ? { titleI18n: { hi: spec.titleHi } } : {}),
      occasions: spec.occasions,
      relationships: spec.relationships ?? [],
      moods: spec.moods ?? [],
      tags: spec.tags ?? [],
      languages,
      visibility: "public",
    },
    content: { schemaVersion: 1, settings, blocks },
  });
  if (!r.ok) throw new Error(`Template "${spec.id}" is invalid: ${JSON.stringify(r.issues)}`);
  return r.template;
}
