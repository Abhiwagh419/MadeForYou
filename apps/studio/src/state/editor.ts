import { newId, createBlock, registry, type Block, type Content, type Settings, type Style } from "@madeforyou/schema";

/* ---------- pure content operations (all return a new Content) ---------- */

const mapBlock = (c: Content, id: string, fn: (b: Block) => Block): Content => ({
  ...c,
  blocks: c.blocks.map((b) => (b.id === id ? fn(b) : b)),
});

export function addBlock(c: Content, type: string, afterId?: string | null): { content: Content; id: string } {
  const b = createBlock(type);
  const at = afterId ? c.blocks.findIndex((x) => x.id === afterId) + 1 : c.blocks.length;
  const blocks = [...c.blocks.slice(0, at), b, ...c.blocks.slice(at)];
  return { content: { ...c, blocks }, id: b.id };
}

export const removeBlock = (c: Content, id: string): Content => ({ ...c, blocks: c.blocks.filter((b) => b.id !== id) });

export function moveBlock(c: Content, id: string, dir: -1 | 1): Content {
  const i = c.blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.blocks.length) return c;
  const blocks = [...c.blocks];
  [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
  return { ...c, blocks };
}

export function duplicateBlock(c: Content, id: string): { content: Content; id: string } {
  const i = c.blocks.findIndex((b) => b.id === id);
  if (i < 0) return { content: c, id };
  const copy: Block = { ...structuredClone(c.blocks[i]!), id: newId() };
  return { content: { ...c, blocks: [...c.blocks.slice(0, i + 1), copy, ...c.blocks.slice(i + 1)] }, id: copy.id };
}

export const toggleVisible = (c: Content, id: string): Content => mapBlock(c, id, (b) => ({ ...b, visible: !b.visible }));
export const setStyle = (c: Content, id: string, patch: Partial<Style>): Content => mapBlock(c, id, (b) => ({ ...b, style: { ...b.style, ...patch } }));

export const setSettings = (c: Content, patch: Partial<Settings>): Content => ({ ...c, settings: { ...c.settings, ...patch } });

/** One line describing a block in the list: its first filled text field. */
export function blockSummary(b: Block): string {
  const def = registry[b.type];
  if (!def) return "";
  for (const [name, f] of Object.entries(def.fields)) {
    if (f.kind !== "text" && f.kind !== "longtext") continue;
    const v = b.fields[name];
    if (typeof v === "string" && v.trim() && !b.ph.includes(name)) return v.trim().slice(0, 48);
  }
  return "";
}

/* ---------- history ---------- */

export interface EditorState {
  content: Content;
  past: Content[];
  future: Content[];
  lastKey?: string;
  lastAt: number;
}
export type EditorAction =
  | { type: "apply"; fn: (c: Content) => Content; key?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; content: Content };

export const initEditor = (content: Content): EditorState => ({ content, past: [], future: [], lastAt: 0 });

const LIMIT = 100;
const COALESCE_MS = 900;

/** Typing in one field becomes a single undo step; everything else is one step per action. */
export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case "apply": {
      const next = a.fn(s.content);
      if (next === s.content) return s;
      const t = Date.now();
      const merge = !!a.key && a.key === s.lastKey && t - s.lastAt < COALESCE_MS && s.past.length > 0;
      return {
        content: next,
        past: merge ? s.past : [...s.past, s.content].slice(-LIMIT),
        future: [],
        lastKey: a.key,
        lastAt: t,
      };
    }
    case "undo": {
      const prev = s.past[s.past.length - 1];
      return prev ? { content: prev, past: s.past.slice(0, -1), future: [s.content, ...s.future], lastAt: 0 } : s;
    }
    case "redo": {
      const [nxt, ...rest] = s.future;
      return nxt ? { content: nxt, past: [...s.past, s.content], future: rest, lastAt: 0 } : s;
    }
    case "replace":
      return initEditor(a.content);
  }
}
