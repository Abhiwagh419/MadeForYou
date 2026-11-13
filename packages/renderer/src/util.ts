/** Small pure helpers for the blocks. Kept free of the schema package so the page stays light. */

/** The shape the author cropped a photo to. Without it the photo fills its frame and is centre-cropped. */
export function shape(ref?: { ratio?: number } | null): { aspectRatio: string } | undefined {
  const r = ref?.ratio;
  return typeof r === "number" && r >= 0.2 && r <= 5 ? { aspectRatio: String(r) } : undefined;
}

const SAFE = new Set(["https:", "http:", "mailto:", "tel:"]);

/** A link that is safe to put in href, or "" if it is not. (Same rule as the schema's isSafeLink; a test keeps them in step.) */
export function safeHref(v: string): string {
  if (!v) return "";
  try {
    return SAFE.has(new URL(v).protocol) ? v : "";
  } catch {
    return "";
  }
}

/** A date-only value means midnight in India (IST). */
export function parseTarget(v: string): number | null {
  if (!v) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+05:30` : v;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

const IST_MS = 5.5 * 3600 * 1000;

/** Calendar difference between a date (in IST) and now, as years, months, days, plus the total number of days. */
export function togetherSince(since: string, nowMs: number): { y: number; m: number; d: number; days: number; future: boolean } | null {
  const m = since.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const start = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  const today = new Date(nowMs + IST_MS);
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round(Math.abs(end - start) / 86_400_000);
  if (end < start) return { y: 0, m: 0, d: 0, days, future: true };
  const a = new Date(start), b = new Date(end);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let mo = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) {
    mo--;
    d += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate();
  }
  if (mo < 0) {
    y--;
    mo += 12;
  }
  return { y, m: mo, d, days, future: false };
}

/** "Saturday, 14 February 2027" and "6:30 pm", always shown in India time so every guest sees the same thing. */
export function formatEvent(when: string): { date: string; time: string } | null {
  const t = parseTarget(when);
  if (t === null) return null;
  const hasTime = /T\d{2}:\d{2}/.test(when);
  const d = new Date(t);
  return {
    date: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }),
    time: hasTime ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "",
  };
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file (.ics) for the event, or "" if the date is not valid. */
export function buildIcs(e: { title: string; when: string; place?: string; note?: string }, nowMs = Date.now()): string {
  const start = parseTarget(e.when);
  if (start === null) return "";
  const allDay = !/T\d{2}:\d{2}/.test(e.when);
  const day = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10).replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MadeForYou//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${stamp(start)}-${Math.abs([...e.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}@madeforyou`,
    `DTSTAMP:${stamp(nowMs)}`,
    allDay ? `DTSTART;VALUE=DATE:${day(start)}` : `DTSTART:${stamp(start)}`,
    allDay ? `DTEND;VALUE=DATE:${day(start + 86_400_000)}` : `DTEND:${stamp(start + 2 * 3600_000)}`,
    `SUMMARY:${esc(e.title || "Event")}`,
    ...(e.place ? [`LOCATION:${esc(e.place)}`] : []),
    ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
