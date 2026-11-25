import { validateTemplate, type Template } from "@madeforyou/schema";
import mothersDay from "./mothers-day-letter.json";
import birthday from "./birthday-countdown.json";
import { built } from "./library";
import { festivals } from "./festivals";
import { moments } from "./moments";
import { trending } from "./trending";

export * from "./occasions";
export * from "./search";
export { tpl, block } from "./build";

const RAW = [mothersDay, birthday];

const fromJson: Template[] = RAW.map((raw) => {
  const r = validateTemplate(raw);
  if (!r.ok) {
    throw new Error(`Invalid template "${(raw as { meta?: { id?: string } }).meta?.id}": ${JSON.stringify(r.issues)}`);
  }
  return r.template;
});

export const templates: Template[] = [...fromJson, ...built, ...festivals, ...moments, ...trending];

export const isTrending = (t: Template) => t.meta.tags.includes("trending");

export const getTemplate = (id: string) => templates.find((t) => t.meta.id === id);
