import { assetIds, type Content, type Template } from "@madeforyou/schema";
import { useSyncExternalStore } from "react";
import { api, apiRaw, ApiError } from "./api";
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

/* ---------- "the server did not accept my sign-in" ---------- */
/** How long to wait before the one quiet retry of a refused login. Tests shorten it. */
export const authRetry = { delayMs: 1200 };

let authProblem: string | null = null;
const problemListeners = new Set<() => void>();
export function setAuthProblem(msg: string | null) {
  authProblem = msg;
  problemListeners.forEach((l) => l());
}
export const useAuthProblem = () => useSyncExternalStore((cb) => (problemListeners.add(cb), () => problemListeners.delete(cb)), () => authProblem, () => authProblem);

/** Asks the server why it refused our login, in plain words. */
export async function explainSignIn(): Promise<string> {
  try {
    const r = await apiRaw<{ ok: boolean; problem: string | null }>("/diag");
    return r.data?.problem ?? "The server did not accept your sign-in. Try signing out and in again.";
  } catch {
    return "We could not reach the server to check your sign-in.";
  }
}

/** Call when a request failed. If it was a 401 while signed in, shows the reason in a banner. */
export async function handleAuthError(e: unknown): Promise<boolean> {
  if (e instanceof ApiError && e.status === 401) {
    setAuthProblem(await explainSignIn());
    return true;
  }
  return false;
}

let refresh: ReturnType<typeof setTimeout> | undefined;
/** Photo links are signed for six hours; renew a little before they lapse. Throws if the server refuses the login. */
export async function refreshOwnerToken() {
  clearTimeout(refresh);
  try {
    const { token } = await api<{ token: string }>("/me/token");
    setOwnerToken(token);
    setAuthProblem(null);
    refresh = setTimeout(() => refreshOwnerToken().catch(() => {}), 5 * 3600 * 1000);
  } catch (e) {
    setOwnerToken(null);
    throw e;
  }
}

export async function pushTemplate(t: Template, fromPage?: string) {
  await api(`/templates/${t.meta.id}`, { method: "PUT", json: { template: t, fromPage } });
}

export async function fetchPublicTemplates(): Promise<Template[]> {
  const { templates } = await api<{ templates: Template[] }>("/templates", { auth: false });
  return templates;
}

export interface SyncReport {
  pushed: number;
  republished: number;
  /** Published here with a password, but missing on the server: publishing again must ask for the password. */
  needsRepublish: string[];
  failed: { title: string; reason: string }[];
  pulled: number;
}

/**
 * Brings the server and this device into line: saves every page here to the account, restores any
 * published page the server lost, and fetches pages made elsewhere. Never publishes a password-protected
 * page without its password (that would silently remove the protection).
 */
export async function syncAll(): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, republished: 0, needsRepublish: [], failed: [], pulled: 0 };
  for (const rec of Object.values(getState().pages)) {
    try {
      const server = await pushPage(rec);
      report.pushed++;
      if (rec.status === "published" && server.status !== "published") {
        if (rec.access.passwordHash) {
          savePage(rec.id, { status: "draft" });
          report.needsRepublish.push(rec.title);
          continue;
        }
        await api(`/pages/${rec.id}/publish`, {
          method: "POST",
          json: { slug: rec.slug, visibility: rec.access.visibility, unlockAt: rec.access.unlockAt ?? null, expiresAt: rec.access.expiresAt ?? null },
        });
        report.republished++;
      }
    } catch (e) {
      report.failed.push({ title: rec.title, reason: (e as Error).message });
    }
  }
  report.pulled = await pullPages();
  return report;
}
