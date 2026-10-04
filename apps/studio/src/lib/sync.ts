import { assetIds, type Content, type Template } from "@madeforyou/schema";
import { api, ApiError } from "./api";
import { getLocalBlob, setOwnerToken } from "./assets";
import { getState, savePage, upsertPages, type Access, type PageRecord } from "../state/store";

/** The server's view of a page, as returned by the API. */
export interface ServerPage {
  id: string; title: string; templateId?: string; content: Content; slug: string; status: "draft" | "published";
  createdAt: string; updatedAt: string; publishedAt?: string;
  access: { visibility: "private" | "unlisted"; hasPassword: boolean; unlockAt: string | null; expiresAt: string | null };
}

export const toLocalAccess = (a: ServerPage["access"]): Access => ({
  visibility: a.visibility,
  passwordHash: a.hasPassword ? "server" : undefined, // the real hash never leaves the server
  unlockAt: a.unlockAt,
  expiresAt: a.expiresAt,
});

export const toLocalPage = (s: ServerPage): PageRecord => ({
  id: s.id, title: s.title, templateId: s.templateId, content: s.content, slug: s.slug, status: s.status,
  access: toLocalAccess(s.access), createdAt: s.createdAt, updatedAt: s.updatedAt, publishedAt: s.publishedAt,
});

/** Last write wins: a server page replaces the local copy only if it is newer. Pure, so it is easy to test. */
export function mergeServerPages(local: Record<string, PageRecord>, server: ServerPage[]): PageRecord[] {
  const out: PageRecord[] = [];
  for (const s of server) {
    const mine = local[s.id];
    if (!mine || Date.parse(s.updatedAt) > Date.parse(mine.updatedAt)) out.push(toLocalPage(s));
  }
  return out;
}

const UPLOADED = "mfy:uploaded";
const uploaded = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};

const toBuffer = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });

/** Sends photos that only exist on this device. Photos pulled from the server are skipped. */
export async function uploadAssets(content: Content) {
  const done = uploaded();
  for (const id of assetIds(content)) {
    if (done.has(id)) continue;
    const blob = await getLocalBlob(id);
    if (!blob) continue;
    await api(`/assets/${id}`, { method: "PUT", body: await toBuffer(blob), headers: { "content-type": blob.type || "image/webp" } });
    done.add(id);
    localStorage.setItem(UPLOADED, JSON.stringify([...done]));
  }
}

/** Saves a page (and its photos) to the server. */
export async function pushPage(rec: PageRecord): Promise<ServerPage> {
  await uploadAssets(rec.content);
  const { page } = await api<{ page: ServerPage }>(`/pages/${rec.id}`, {
    method: "PUT",
    json: { title: rec.title, templateId: rec.templateId, content: rec.content },
  });
  return page;
}

export interface PublishOptions {
  slug: string;
  visibility: "private" | "unlisted";
  /** undefined keeps the current password, null removes it, a string sets it. */
  password?: string | null;
  unlockAt: string | null;
  expiresAt: string | null;
}

export async function publishRemote(id: string, o: PublishOptions): Promise<PageRecord> {
  const rec = getState().pages[id];
  if (!rec) throw new ApiError(404, "Page not found");
  await pushPage(rec);
  const { page } = await api<{ page: ServerPage }>(`/pages/${id}/publish`, { method: "POST", json: o });
  const local = toLocalPage(page);
  savePage(id, { slug: local.slug, status: local.status, access: local.access, publishedAt: local.publishedAt });
  return getState().pages[id]!;
}

export async function pullPages(): Promise<number> {
  const { pages } = await api<{ pages: ServerPage[] }>("/me/pages");
  const fresh = mergeServerPages(getState().pages, pages);
  upsertPages(fresh);
  return fresh.length;
}

export async function removeRemote(id: string) {
  try {
    await api(`/pages/${id}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
}

let refresh: ReturnType<typeof setTimeout> | undefined;
/** Photo links are signed for six hours; renew a little before they lapse. */
export async function refreshOwnerToken() {
  clearTimeout(refresh);
  try {
    const { token } = await api<{ token: string }>("/me/token");
    setOwnerToken(token);
    refresh = setTimeout(refreshOwnerToken, 5 * 3600 * 1000);
  } catch {
    setOwnerToken(null);
  }
}

export async function pushTemplate(t: Template, fromPage?: string) {
  await api(`/templates/${t.meta.id}`, { method: "PUT", json: { template: t, fromPage } });
}

export async function fetchPublicTemplates(): Promise<Template[]> {
  const { templates } = await api<{ templates: Template[] }>("/templates", { auth: false });
  return templates;
}
