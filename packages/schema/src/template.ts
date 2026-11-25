import { z } from "zod";
import { validateContent, type Content, type Issue } from "./content";

const slug = z.string().regex(/^[a-z0-9-]{2,40}$/);

export const TemplateMetaSchema = z.object({
  id: slug,
  title: z.string().min(3).max(80),
  titleI18n: z.record(z.string(), z.string().max(80)).optional(),
  occasions: z.array(slug).min(1).max(5),
  relationships: z.array(slug).max(5).default([]),
  moods: z.array(z.enum(["romantic", "emotional", "funny", "minimal", "festive"])).max(3).default([]),
  tags: z.array(z.string().min(2).max(30)).max(30).default([]),
  languages: z.array(z.string().min(2).max(8)).min(1).max(8),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
});
export type TemplateMeta = z.infer<typeof TemplateMetaSchema>;
export interface Template {
  meta: TemplateMeta;
  content: Content;
}

export function validateTemplate(input: unknown): { ok: true; template: Template } | { ok: false; issues: Issue[] } {
  const obj = (input ?? {}) as { meta?: unknown; content?: unknown };
  const issues: Issue[] = [];
  const meta = TemplateMetaSchema.safeParse(obj.meta);
  if (!meta.success) {
    meta.error.issues.forEach((i) => issues.push({ path: `meta.${i.path.join(".")}`, message: i.message }));
  }
  const content = validateContent(obj.content);
  if (!content.ok) content.issues.forEach((i) => issues.push({ path: `content.${i.path}`, message: i.message }));
  if (issues.length || !meta.success || !content.ok) return { ok: false, issues };
  return { ok: true, template: { meta: meta.data, content: content.content } };
}
