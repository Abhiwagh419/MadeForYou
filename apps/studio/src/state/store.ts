import { useSyncExternalStore } from "react";
import { validateContent, validateTemplate, type Content, type Template } from "@madeforyou/schema";
import { uid } from "../lib/util";

export interface Access {
  visibility: "private" | "unlisted";
  passwordHash?: string;
  unlockAt?: string | null;
  expiresAt?: string | null;
}
export interface PageRecord {
  id: string;
  title: string;
  templateId?: string;
  content: Content;
  slug: string;
  access: Access;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  takenDown?: { at: string; reason: string };
}
export interface TemplateRecord {
  template: Template;
  fromPage?: string;
  createdAt: string;
}
export interface State {
  pages: Record<string, PageRecord>;
  templates: Record<string, TemplateRecord>;
}

const KEY = "mfy:v1";
let state: State = load();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function load(): State {
  const out: State = { pages: {}, templates: {} };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return out;
    const parsed = JSON.parse(raw) as State;
    for (const [id, p] of Object.entries(parsed.pages ?? {})) {
      const r = validateContent(p.content);
      if (r.ok) out.pages[id] = { ...p, content: r.content };
    }
    for (const [id, t] of Object.entries(parsed.templates ?? {})) {
      const r = validateTemplate(t.template);
      if (r.ok) out.templates[id] = { ...t, template: r.template };
    }
  } catch {}
  return out;
}

function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, 250);
}

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
  persist();
}

export function resetState() {
  clearTimeout(timer);
  state = { pages: {}, templates: {} };
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export const getState = () => state;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

const now = () => new Date().toISOString();

export function createPage(input: { title: string; content: Content; templateId?: string }): PageRecord {
  const id = uid("pg");
  const rec: PageRecord = {
    id, title: input.title, templateId: input.templateId, content: structuredClone(input.content),
    slug: "", access: { visibility: "unlisted" }, status: "draft", createdAt: now(), updatedAt: now(),
  };
  set({ ...state, pages: { ...state.pages, [id]: rec } });
  return rec;
}

export function savePage(id: string, patch: Partial<Omit<PageRecord, "id">>) {
  const cur = state.pages[id];
  if (!cur) return;
  set({ ...state, pages: { ...state.pages, [id]: { ...cur, ...patch, updatedAt: now() } } });
}

export function upsertPages(records: PageRecord[]) {
  if (!records.length) return;
  const pages = { ...state.pages };
  for (const r of records) pages[r.id] = r;
  set({ ...state, pages });
}

export function deletePage(id: string) {
  const { [id]: _gone, ...rest } = state.pages;
  set({ ...state, pages: rest });
}

export function duplicatePage(id: string): PageRecord | undefined {
  const cur = state.pages[id];
  return cur ? createPage({ title: `${cur.title} (copy)`, content: cur.content, templateId: cur.templateId }) : undefined;
}

export const slugTaken = (slug: string, exceptId?: string) =>
  Object.values(state.pages).some((p) => p.slug === slug && p.id !== exceptId && p.status === "published");

export const pageBySlug = (slug: string) => Object.values(state.pages).find((p) => p.slug === slug && p.status === "published");

export function addTemplate(template: Template, fromPage?: string) {
  set({ ...state, templates: { ...state.templates, [template.meta.id]: { template, fromPage, createdAt: now() } } });
}
export function deleteTemplate(id: string) {
  const { [id]: _gone, ...rest } = state.templates;
  set({ ...state, templates: rest });
}

export function resetStore(next: State = { pages: {}, templates: {} }) {
  set(next);
}
