import { guidedQuestions, starterSkeleton, type Template } from "@madeforyou/schema";
import { createPage } from "../state/store";
import { go } from "./router";

export function startFromTemplate(t: Template) {
  const rec = createPage({ title: t.meta.title, content: t.content, templateId: t.meta.id });
  go(guidedQuestions(rec.content).length ? `/make/${rec.id}` : `/edit/${rec.id}`);
}

export function startFromScratch(title = "Untitled page") {
  const rec = createPage({ title, content: starterSkeleton() });
  go(`/make/${rec.id}`);
}
