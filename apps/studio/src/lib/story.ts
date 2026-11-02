import QRCode from "qrcode";
import { BRAND, THEMES } from "@madeforyou/ui";

export interface StoryInput {
  title: string;
  recipient: string;
  url: string;
  theme: string;
  coverUrl?: string;
}

/** Splits text into at most `maxLines` lines that fit `maxWidth`. `measure` is the canvas's measureText width. */
export function wrapLines(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines);
    keep[maxLines - 1] = `${keep[maxLines - 1]!.replace(/[.,;:!?…\s]+$/, "")}…`;
    return keep;
  }
  return lines;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });

/** A 1080 x 1920 picture for Instagram or WhatsApp status: the page's look, its title, and a QR code to open it. */
export async function makeStoryImage(i: StoryInput): Promise<Blob> {
  const t = THEMES[i.theme] ?? THEMES["rose-garden"]!;
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const heading = t.fontHeading.split(",")[0]!.replace(/"/g, "");
  const body = t.fontBody.split(",")[0]!.replace(/"/g, "");
  await Promise.all([`${t.titleWeight} 90px "${heading}"`, `italic 500 60px "${heading}"`, `500 34px "${body}"`].map((f) => document.fonts?.load(f).catch(() => undefined)));

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, col] of [[900, 180, 620, t.accent], [120, 1700, 700, t.primary]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${col}40`);
    g.addColorStop(1, `${col}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // the arched cover, as on the page
  const aw = 480, ah = 620, ax = (W - aw) / 2, ay = 150;
  const arch = (pad = 0) => {
    ctx.beginPath();
    ctx.moveTo(ax - pad, ay + ah + pad);
    ctx.lineTo(ax - pad, ay + aw / 2);
    ctx.arc(W / 2, ay + aw / 2, aw / 2 + pad, Math.PI, 0);
    ctx.lineTo(ax + aw + pad, ay + ah + pad);
    ctx.closePath();
  };
  arch(18); ctx.strokeStyle = t.primary; ctx.lineWidth = 6; ctx.stroke();
  ctx.save(); arch(); ctx.clip();
  const fill = ctx.createLinearGradient(0, ay, 0, ay + ah);
  fill.addColorStop(0, t.soft); fill.addColorStop(1, `${t.accent}99`);
  ctx.fillStyle = fill; ctx.fillRect(ax, ay, aw, ah);
  if (i.coverUrl) {
    try {
      const img = await loadImage(i.coverUrl);
      const k = Math.max(aw / img.width, ah / img.height);
      ctx.drawImage(img, ax + (aw - img.width * k) / 2, ay + (ah - img.height * k) / 2, img.width * k, img.height * k);
    } catch { /* keep the colour fill */ }
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = t.text;
  ctx.font = `${t.titleWeight} 88px "${heading}", Georgia, serif`;
  const lines = wrapLines(i.title || "A page made just for you", 900, 2, (s) => ctx.measureText(s).width);
  lines.forEach((l, n) => ctx.fillText(l, W / 2, 900 + n * 100));
  let y = 900 + lines.length * 100;
  if (i.recipient) {
    ctx.fillStyle = t.primary;
    ctx.font = `${t.recipientStyle === "italic" ? "italic " : ""}500 62px "${heading}", Georgia, serif`;
    ctx.fillText(i.recipient, W / 2, y + 20);
    y += 90;
  }

  const qr = await loadImage(await QRCode.toDataURL(i.url, { margin: 1, width: 360, color: { dark: t.text, light: "#FFFFFF" } }));
  const qy = Math.max(y + 40, 1260);
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath(); ctx.roundRect(W / 2 - 210, qy - 20, 420, 420, 32); ctx.fill();
  ctx.drawImage(qr, W / 2 - 180, qy + 10, 360, 360);
  ctx.fillStyle = t.muted;
  ctx.font = `500 34px "${body}", system-ui, sans-serif`;
  ctx.fillText("Scan, or tap the link", W / 2, qy + 455);
  ctx.fillText(i.url.replace(/^https?:\/\//, "").slice(0, 46), W / 2, qy + 500);
  ctx.globalAlpha = 0.7;
  ctx.fillText(BRAND.badgeText, W / 2, H - 60);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the picture"))), "image/png"));
}
