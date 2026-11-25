import { BlockSchema, SettingsSchema, type Block, type Content } from "./content";
import { placeholderValue } from "./fields";
import { registry } from "./registry";

export function newId(): string {
  const rnd = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 10) ?? Math.random().toString(36).slice(2, 12);
  return `blk_${rnd}`;
}

export function createBlock(type: string, id: string = newId()): Block {
  const def = registry[type];
  if (!def) throw new Error(`Unknown block type "${type}"`);
  return BlockSchema.parse({
    id,
    type,
    v: def.version,
    fields: Object.fromEntries(Object.entries(def.fields).map(([k, d]) => [k, placeholderValue(d)])),
    ph: Object.entries(def.fields).filter(([, d]) => d.personal).map(([k]) => k),
  });
}

export function defaultSettings() {
  return SettingsSchema.parse({});
}

export function starterSkeleton(): Content {
  return {
    schemaVersion: 1,
    settings: defaultSettings(),
    blocks: ["hero", "text", "gallery", "signature"].map((t) => createBlock(t)),
  };
}
