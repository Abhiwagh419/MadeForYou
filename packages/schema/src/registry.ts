import { z } from "zod";
import { shapeToZod } from "./fields";
import { countdown, gallery, hero, letter, signature, text, type BlockDef } from "./blocks";

export const registry: Record<string, BlockDef> = {
  hero,
  text,
  letter,
  gallery,
  countdown,
  signature,
};

export function getBlockDef(type: string): BlockDef | undefined {
  return registry[type];
}

const cache = new Map<string, z.ZodTypeAny>();
export function blockFieldsSchema(def: BlockDef): z.ZodTypeAny {
  let s = cache.get(def.type);
  if (!s) {
    s = shapeToZod(def.fields);
    cache.set(def.type, s);
  }
  return s;
}
