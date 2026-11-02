import { z } from "zod";
import { shapeToZod } from "./fields";
import {
  ask, buttons, checklist, countdown, daysTogether, divider, event, featured, gallery, hero, letter, memory, openWhen,
  map, quiz, quote, reasons, replyBox, reveal, rsvp, signature, text, timeline, video, voiceNote, wishes, type BlockDef,
} from "./blocks";

export const registry: Record<string, BlockDef> = {
  hero, featured, gallery, timeline, daysTogether, video,
  text, letter, quote, reasons, checklist, openWhen,
  countdown, reveal, ask, quiz, memory,
  event, buttons, divider, signature,
  voiceNote, map, wishes, replyBox, rsvp,
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
