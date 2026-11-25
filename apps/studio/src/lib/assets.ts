import { useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { LIMITS, type AssetRef, type Content } from "@madeforyou/schema";
import { apiBase, isRemote } from "./config";
import { roundRatio } from "./crop";
import { uid } from "./util";

const urlCache = new Map<string, string>();

let ownerToken: string | null = null;
const tokenListeners = new Set<() => void>();
export function setOwnerToken(t: string | null) {
  ownerToken = t;
  tokenListeners.forEach((l) => l());
}
const useOwnerToken = () => useSyncExternalStore((cb) => (tokenListeners.add(cb), () => tokenListeners.delete(cb)), () => ownerToken, () => ownerToken);
const remoteUrl = (id: string, token?: string | null) => {
  const t = token ?? ownerToken;
  return isRemote() && t ? `${apiBase()}/a/${id}?t=${encodeURIComponent(t)}` : undefined;
};
const memory = new Map<string, Blob>();

export async function clearLocalAssets() {
  memory.clear();
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((res) => {
    const req = indexedDB.deleteDatabase("mfy-assets");
    req.onsuccess = req.onerror = req.onblocked = () => res();
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("mfy-assets", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("blobs");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(id: string, blob: Blob) {
  memory.set(id, blob);
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put(blob, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {}
}

async function getBlob(id: string): Promise<Blob | undefined> {
  const m = memory.get(id);
  if (m) return m;
  if (typeof indexedDB === "undefined") return undefined;
  try {
    const db = await openDb();
    return await new Promise<Blob | undefined>((res, rej) => {
      const req = db.transaction("blobs").objectStore("blobs").get(id);
      req.onsuccess = () => res(req.result as Blob | undefined);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return undefined;
  }
}

export const getLocalBlob = (id: string) => getBlob(id);

export const MAX_EDGE = 1280;

export async function compressImage(file: Blob): Promise<Blob> {
  return (await compressWithShape(file)).blob;
}

async function compressWithShape(file: Blob): Promise<{ blob: Blob; ratio?: number }> {
  if (typeof createImageBitmap !== "function") return { blob: file };
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), "image/webp", 0.82));
  return { blob, ratio: roundRatio(w / h) };
}

export function checkImageFile(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large (25 MB max)");
}

export async function saveImage(file: File): Promise<AssetRef> {
  checkImageFile(file);
  const { blob, ratio } = await compressWithShape(file);
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return ratio ? { asset: id, ratio } : { asset: id };
}

export async function saveCropped(blob: Blob, ratio: number): Promise<AssetRef> {
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return { asset: id, ratio };
}

export async function saveAudio(blob: Blob): Promise<AssetRef> {
  if (!/^audio\//.test(blob.type)) throw new Error("Please choose an audio file");
  if (blob.size > LIMITS.assetBytes) throw new Error("That recording is too large. Keep it under a minute, or under 1.5 MB.");
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return { asset: id };
}

const ID_RE = /ast_[A-Za-z0-9_-]{4,64}/g;

export function useAssets(content: Content, token?: string | null): (ref: AssetRef) => string | undefined {
  const owner = useOwnerToken();
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const ids = useMemo(() => [...new Set(JSON.stringify(content).match(ID_RE) ?? [])], [content]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let changed = false;
      for (const id of ids) {
        if (urlCache.has(id)) continue;
        const blob = await getBlob(id);
        if (blob) {
          urlCache.set(id, URL.createObjectURL(blob));
          changed = true;
        }
      }
      if (alive && changed) bump();
    })();
    return () => {
      alive = false;
    };
  }, [ids]);

  return useMemo(() => (ref: AssetRef) => urlCache.get(ref.asset) ?? remoteUrl(ref.asset, token), [version, ids, token, owner]);
}

export const assetUrl = (id: string) => urlCache.get(id);

export function useAssetUrl(id?: string | null): string | undefined {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useOwnerToken();
  useEffect(() => {
    if (!id || urlCache.has(id)) return;
    let alive = true;
    getBlob(id).then((b) => {
      if (!b || !alive) return;
      urlCache.set(id, URL.createObjectURL(b));
      bump();
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return id ? urlCache.get(id) ?? remoteUrl(id) : undefined;
}
