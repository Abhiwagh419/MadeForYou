import { useEffect, useMemo, useReducer } from "react";
import type { AssetRef, Content } from "@madeforyou/schema";
import { uid } from "./util";

/**
 * Photos live in the browser's IndexedDB for now, referenced by id exactly like they will
 * be in R2 later, so pages never store URLs. If IndexedDB is missing (private tabs, tests)
 * a memory map takes over.
 */
const urlCache = new Map<string, string>();
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

export const MAX_EDGE = 1280;

/** Resize to at most 1280px on the long edge and re-encode as WebP, in the browser, before storing. */
export async function compressImage(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/webp", 0.82));
}

export async function saveImage(file: File): Promise<AssetRef> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large (25 MB max)");
  const blob = await compressImage(file);
  const id = uid("ast");
  await putBlob(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return { asset: id };
}

const ID_RE = /ast_[A-Za-z0-9_-]{4,64}/g;

/** Resolves asset references used in `content` to object URLs, re-rendering when they load. */
export function useAssets(content: Content): (ref: AssetRef) => string | undefined {
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

  return useMemo(() => (ref: AssetRef) => urlCache.get(ref.asset), [version, ids]);
}

export const assetUrl = (id: string) => urlCache.get(id);

/** URL for one asset id (or undefined while loading / if it does not exist). */
export function useAssetUrl(id?: string | null): string | undefined {
  const [, bump] = useReducer((x: number) => x + 1, 0);
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
  return id ? urlCache.get(id) : undefined;
}
