export type Rect = { x: number; y: number; w: number; h: number };
export type Corner = "nw" | "ne" | "sw" | "se";

export const MIN_SIDE = 48;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fitRect(bw: number, bh: number, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, w: bw, h: bh };
  let w = bw;
  let h = bw / ratio;
  if (h > bh) { h = bh; w = bh * ratio; }
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

export function moveRect(r: Rect, dx: number, dy: number, bw: number, bh: number): Rect {
  return { ...r, x: clamp(r.x + dx, 0, bw - r.w), y: clamp(r.y + dy, 0, bh - r.h) };
}

export function resizeCorner(r: Rect, corner: Corner, px: number, py: number, ratio: number | null, bw: number, bh: number, min = MIN_SIDE): Rect {
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  const ax = west ? r.x + r.w : r.x;
  const ay = north ? r.y + r.h : r.y;
  const sx = west ? -1 : 1;
  const sy = north ? -1 : 1;
  const maxW = sx > 0 ? bw - ax : ax;
  const maxH = sy > 0 ? bh - ay : ay;
  let w = clamp(sx * (px - ax), 0, maxW);
  let h = clamp(sy * (py - ay), 0, maxH);
  if (ratio) {
    const cap = Math.min(maxW, maxH * ratio);
    w = Math.min(Math.max(w, h * ratio), cap);
    w = Math.max(w, Math.min(min, cap));
    h = w / ratio;
  } else {
    w = Math.max(w, Math.min(min, maxW));
    h = Math.max(h, Math.min(min, maxH));
  }
  return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
}

export function scaleRect(r: Rect, kx: number, ky: number): Rect {
  return { x: r.x * kx, y: r.y * ky, w: r.w * kx, h: r.h * ky };
}

export const roundRatio = (r: number) => Math.round(clamp(r, 0.2, 5) * 1000) / 1000;

export async function cropToBlob(img: HTMLImageElement, r: Rect, shownW: number, shownH: number, maxEdge = 1280): Promise<{ blob: Blob; ratio: number }> {
  const kx = img.naturalWidth / shownW;
  const ky = img.naturalHeight / shownH;
  const sw = r.w * kx;
  const sh = r.h * ky;
  const k = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, r.x * kx, r.y * ky, sw, sh, 0, 0, w, h);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not crop this photo"))), "image/webp", 0.85));
  return { blob, ratio: roundRatio(w / h) };
}
