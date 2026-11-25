import type { Content } from "./content";
import type { FieldDef } from "./fields";
import { registry } from "./registry";

export interface GuidedQuestion {
  blockId: string;
  blockType: string;
  field: string;
  kind: FieldDef["kind"];
  prompt: string;
  required: boolean;
  tier: "essential" | "richer";
}

export function guidedQuestions(content: Content): GuidedQuestion[] {
  const all: GuidedQuestion[] = [];
  for (const block of content.blocks) {
    if (!block.visible) continue;
    const def = registry[block.type];
    if (!def) continue;
    for (const [field, fdef] of Object.entries(def.fields)) {
      if (!fdef.guided || !block.ph.includes(field)) continue;
      all.push({
        blockId: block.id,
        blockType: block.type,
        field,
        kind: fdef.kind,
        prompt: fdef.prompt ?? `Fill in "${field}"`,
        required: !!fdef.required,
        tier: fdef.required ? "essential" : "richer",
      });
    }
  }
  return [...all.filter((q) => q.tier === "essential"), ...all.filter((q) => q.tier === "richer")];
}
