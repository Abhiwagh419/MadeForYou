import { registry } from "./registry";

type Migration = (fields: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[blockType][fromVersion] upgrades fields from `fromVersion` to
 * `fromVersion + 1`. Empty for now: every block is at version 1. When a block's
 * shape changes, bump its `version` and add the step here, then old pages keep working.
 */
export const migrations: Record<string, Record<number, Migration>> = {};

export function migrateBlock<T extends { type: string; v: number; fields: Record<string, unknown> }>(block: T): T {
  const def = registry[block.type];
  if (!def) return block;
  let { v, fields } = block;
  while (v < def.version) {
    const step = migrations[block.type]?.[v];
    if (!step) throw new Error(`Missing migration for ${block.type} v${v} -> v${v + 1}`);
    fields = step(fields);
    v += 1;
  }
  return { ...block, v, fields };
}
