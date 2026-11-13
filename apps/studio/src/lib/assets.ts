import { useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { LIMITS, type AssetRef, type Content } from "@madeforyou/schema";
import { apiBase, isRemote } from "./config";
import { roundRatio } from "./crop";
import { uid } from "./util";

/**
 * Photos live in the browser's IndexedDB for now, referenced by id exactly like they will
 * be in R2 later, so pages never store URLs. If IndexedDB is missing (private tabs, tests)
 * a memory map takes over.
 */
const urlCache = new Map<string, string>();

/* Photos that are not on this device (a page pulled from the server) load through the API with a short-lived token. */
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
  } catch {
    /* kept in memory for this session */
  }
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

/** Resize to at most 1280px on the long edge and re-encode as WebP, in the browser, before storing. */
export async function compressImage(file: Blob): Promise<Blob> {
  return (await compressWithShape(file)).blob;
}

/** Same, and also reports width divided by height so the page can show the whole photo. */
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

/** Throws a friendly message if the file cannot be used as a photo. */
export function checkImageFile(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large (25 MB max)");
}

/** The whole photo, uncropped. Its own shape is remembered so the page never centre-crops it. */
export async function saveImage(file: File): Promise<AssetRef> {
  checkImageFile(file);
  const { blob, ratio } = await compressWithShape(file);
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return ratio ? { asset: id, ratio } : { asset: id };
}

/** A photo the author has already cropped (see CropDialog). */
export async function saveCropped(blob: Blob, ratio: number): Promise<AssetRef> {
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return { asset: id, ratio };
}

/** A voice note is stored exactly as recorded (it is already small: about 30 KB per second). */
export async function saveAudio(blob: Blob): Promise<AssetRef> {
  if (!/^audio\//.test(blob.type)) throw new Error("Please choose an audio file");
  if (blob.size > LIMITS.assetBytes) throw new Error("That recording is too large. Keep it under a minute, or under 1.5 MB.");
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return { asset: id };
}

const ID_RE = /ast_[A-Za-z0-9_-]{4,64}/g;

/** Resolves asset references used in `content` to object URLs, re-rendering when they load. */
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

/** URL for one asset id (or undefined while loading / if it does not exist). */
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
