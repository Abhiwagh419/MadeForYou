import type { Content } from "./content";
import { isEmpty, type FieldDef } from "./fields";
import { registry } from "./registry";

export interface PublishIssue {
  severity: "error" | "warning";
  code: "required-missing" | "placeholder-left" | "image-missing-alt";
  blockId: string;
  field: string;
  message: string;
}

function altIssues(def: FieldDef, value: unknown, blockId: string, field: string): PublishIssue[] {
  const out: PublishIssue[] = [];
  const warn = (suffix = "") =>
    out.push({
      severity: "warning",
      code: "image-missing-alt",
      blockId,
      field: field + suffix,
      message: "Add a short description so people using screen readers can follow the photo",
    });
  if (def.kind === "image" && value && typeof value === "object" && !(value as { alt?: string }).alt) warn();
  if (def.kind === "list" && Array.isArray(value)) {
    value.forEach((item, i) => {
      for (const [k, d] of Object.entries(def.item)) {
        out.push(...altIssues(d, (item as Record<string, unknown>)?.[k], blockId, `${field}[${i}].${k}`));
      }
    });
  }
  return out;
}

/** What the publish checklist shows. Errors block publishing; warnings are shown but allowed. */
export function checkPublishable(content: Content): { canPublish: boolean; issues: PublishIssue[] } {
  const issues: PublishIssue[] = [];
  for (const block of content.blocks) {
    if (!block.visible) continue;
    const def = registry[block.type];
    if (!def) continue;
    for (const [name, fdef] of Object.entries(def.fields)) {
      const value = block.fields[name];
      const isPh = block.ph.includes(name);
      if (fdef.required && (isPh || isEmpty(fdef, value))) {
        issues.push({
          severity: "error",
          code: "required-missing",
          blockId: block.id,
          field: name,
          message: fdef.prompt ?? `"${name}" is required`,
        });
      } else if (isPh) {
        issues.push({
          severity: "warning",
          code: "placeholder-left",
          blockId: block.id,
          field: name,
          message: `Sample text is still showing in "${name}"`,
        });
      }
      issues.push(...altIssues(fdef, value, block.id, name));
    }
  }
  return { canPublish: issues.every((i) => i.severity !== "error"), issues };
}
