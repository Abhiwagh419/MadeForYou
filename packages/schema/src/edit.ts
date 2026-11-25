import type { Block, Content } from "./content";
import { registry } from "./registry";

export function setField(content: Content, blockId: string, field: string, value: unknown, lang?: string): Content {
  const defaultLang = content.settings.languages.default;
  const writingDefault = !lang || lang === defaultLang;
  let found = false;

  const blocks = content.blocks.map((block): Block => {
    if (block.id !== blockId) return block;
    found = true;
    const fdef = registry[block.type]?.fields[field];
    if (!fdef) throw new Error(`Unknown field "${field}" on block type "${block.type}"`);

    if (writingDefault) {
      const i18n = Object.fromEntries(
        Object.entries(block.i18n ?? {})
          .map(([l, entries]) => [l, Object.fromEntries(Object.entries(entries).filter(([k]) => k !== field))] as const)
          .filter(([, entries]) => Object.keys(entries).length > 0),
      );
      return {
        ...block,
        fields: { ...block.fields, [field]: value },
        ph: block.ph.filter((n) => n !== field),
        i18n: Object.keys(i18n).length ? i18n : undefined,
      };
    }

    if (fdef.kind !== "text" && fdef.kind !== "longtext") throw new Error(`"${field}" cannot be translated`);
    if (typeof value !== "string") throw new Error("A translation must be text");
    return { ...block, i18n: { ...block.i18n, [lang!]: { ...block.i18n?.[lang!], [field]: value } } };
  });

  if (!found) throw new Error(`No block with id "${blockId}"`);
  return { ...content, blocks };
}
