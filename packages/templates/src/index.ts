import { validateTemplate, type Template } from "@madeforyou/schema";
import mothersDay from "./mothers-day-letter.json";
import birthday from "./birthday-countdown.json";

const RAW = [mothersDay, birthday];

/** Fails fast: a malformed launch template should break the build, never reach a user. */
export const templates: Template[] = RAW.map((raw) => {
  const r = validateTemplate(raw);
  if (!r.ok) {
    throw new Error(`Invalid template "${(raw as { meta?: { id?: string } }).meta?.id}": ${JSON.stringify(r.issues)}`);
  }
  return r.template;
});

export const getTemplate = (id: string) => templates.find((t) => t.meta.id === id);
