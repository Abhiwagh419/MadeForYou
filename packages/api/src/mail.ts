import { cleanEmail, type Content } from "@madeforyou/schema";
import { readToken, signToken } from "./crypto";
import type { Deps, Env } from "./types";

/* =============================================================================================
 * Email. Three kinds are sent, all through Brevo's free plan (300 a day, no card):
 *   1. a page, sent to someone on a date the owner chose ("deliveries")
 *   2. one reminder to a guest who left an email on the RSVP, a day before the event
 *   3. "this page ends soon", a day before it switches off, to the owner and to people it was sent to
 * Nothing here runs on its own: a small scheduler Worker calls /api/cron/tick every 15 minutes.
 * ============================================================================================= */

export const DAILY_CAP = 280; // Brevo's free plan stops at 300 a day; keep a margin
const PER_TICK = 25; // stays well under the platform's limit of outside calls per request
const DAY = 86_400_000;
const MAX_TRIES = 4;

export interface MailConfig { key: string; from: string; fromName: string }

/** Email works only when a Brevo key and a verified sender address are both set. */
export function mailConfig(env: Env): MailConfig | null {
  const key = env.BREVO_API_KEY?.trim();
  const from = cleanEmail(env.MAIL_FROM ?? "");
  if (!key || !from) return null;
  return { key, from, fromName: (env.MAIL_FROM_NAME ?? "").trim().slice(0, 60) || "MadeForYou" };
}
/** Reminders also need the scheduler's shared secret. */
export const remindersOn = (env: Env) => !!mailConfig(env) && !!env.CRON_SECRET?.trim();

export class MailError extends Error {
  constructor(message: string, public retry: boolean) {
    super(message);
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/* ---------- sending ---------- */

interface Outgoing { to: string; toName?: string; subject: string; html: string; text: string; unsubscribeUrl?: string }

export async function sendMail(env: Env, deps: Deps, m: Outgoing): Promise<void> {
  const cfg = mailConfig(env);
  if (!cfg) throw new MailError("Email is not switched on", false);
  let res: Response;
  try {
    res = await deps.fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": cfg.key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: cfg.from, name: cfg.fromName },
        to: [{ email: m.to, ...(m.toName ? { name: m.toName } : {}) }],
        subject: m.subject,
        htmlContent: m.html,
        textContent: m.text,
        ...(m.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
    });
  } catch {
    throw new MailError("Could not reach the email service", true);
  }
  if (res.ok) return;
  let detail = "";
  try {
    detail = String(((await res.json()) as { message?: unknown }).message ?? "");
  } catch {
    /* no body */
  }
  throw new MailError(`The email service refused it (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`, res.status >= 500 || res.status === 429);
}

/* ---------- who has said stop ---------- */

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
};

export const unsubToken = (env: Env, email: string, now: number) => signToken(env.SESSION_SECRET, `unsub:${b64(email)}`, 400 * 86400, now);

/** The address a valid stop-emails link is for, or null. */
export async function readUnsub(env: Env, token: string | undefined | null, now: number): Promise<string | null> {
  const scope = await readToken(env.SESSION_SECRET, token, now);
  if (!scope?.startsWith("unsub:")) return null;
  return cleanEmail(unb64(scope.slice(6)));
}

export async function isBlocked(env: Env, email: string): Promise<boolean> {
  return !!(await env.DB.prepare("SELECT 1 AS x FROM mail_blocks WHERE email = ?").bind(email).first());
}
export async function blockEmail(env: Env, email: string, now: number): Promise<void> {
  await env.DB.prepare("INSERT INTO mail_blocks (email, at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING").bind(email, iso(now)).run();
  // anything still waiting for this address is cancelled
  await env.DB.prepare("UPDATE deliveries SET status = 'cancelled', error = 'This person asked not to get emails' WHERE to_email = ? AND status IN ('scheduled', 'sending')").bind(email).run();
}

/* ---------- the book-keeping that stops double sends and counts the daily limit ---------- */

const claim = async (env: Env, key: string, now: number) =>
  (await env.DB.prepare("INSERT INTO mail_log (key, at, sent) VALUES (?, ?, 1) ON CONFLICT(key) DO NOTHING").bind(key, iso(now)).run()).meta?.changes === 1;
const release = (env: Env, key: string) => env.DB.prepare("DELETE FROM mail_log WHERE key = ?").bind(key).run();
const markUnsent = (env: Env, key: string) => env.DB.prepare("UPDATE mail_log SET sent = 0 WHERE key = ?").bind(key).run();
const skip = (env: Env, key: string, now: number) => env.DB.prepare("INSERT INTO mail_log (key, at, sent) VALUES (?, ?, 0) ON CONFLICT(key) DO NOTHING").bind(key, iso(now)).run();

export async function sentInLastDay(env: Env, now: number): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM mail_log WHERE sent = 1 AND at > ?").bind(iso(now - DAY)).first<{ n: number }>();
  return r?.n ?? 0;
}

/* ---------- events and dates ---------- */

/** A date with no zone means India time, wherever the server runs. */
export function eventStart(when: unknown): number | null {
  if (typeof when !== "string" || !when.trim()) return null;
  let v = when.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += "T00:00:00+05:30";
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) v += "+05:30";
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

export interface EventInfo { at: number; hasTime: boolean; title: string; place: string; mapsLink: string; note: string }

/** The earliest event on the page that has not started yet. */
export function nextEvent(content: Content, now: number): EventInfo | null {
  let best: EventInfo | null = null;
  for (const b of content.blocks) {
    if (b.type !== "event" || !b.visible) continue;
    const at = eventStart(b.fields.when);
    if (at === null || at <= now) continue;
    if (!best || at < best.at) {
      const s = (k: string) => (typeof b.fields[k] === "string" ? (b.fields[k] as string) : "");
      best = { at, hasTime: /T\d{2}:\d{2}/.test(String(b.fields.when)), title: s("title"), place: s("place"), mapsLink: /^https?:\/\//i.test(s("mapsLink")) ? s("mapsLink") : "", note: s("note") };
    }
  }
  return best;
}

const fmtDate = (ms: number, withTime: boolean) => {
  const o: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" };
  if (withTime) Object.assign(o, { hour: "numeric", minute: "2-digit", hour12: true });
  return new Date(ms).toLocaleString("en-IN", o).replace(/\bam\b/, "am").replace(/\bpm\b/, "pm") + (withTime ? " (India time)" : "");
};

/* ---------- the owner's email, looked up once from Clerk ---------- */

export async function ownerEmail(env: Env, deps: Deps, userId: string, now: number): Promise<string | null> {
  const u = await env.DB.prepare("SELECT email, email_at FROM users WHERE id = ?").bind(userId).first<{ email: string | null; email_at: string | null }>();
  if (u?.email && u.email_at && now - Date.parse(u.email_at) < 30 * DAY) return u.email;
  const secret = env.CLERK_SECRET_KEY?.trim();
  if (!secret || userId.startsWith("dev_")) return u?.email ?? null;
  try {
    const res = await deps.fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, { headers: { authorization: `Bearer ${secret}` } });
    if (!res.ok) return u?.email ?? null;
    const j = (await res.json()) as { primary_email_address_id?: string | null; email_addresses?: { id: string; email_address: string }[] };
    const list = j.email_addresses ?? [];
    const pick = list.find((e) => e.id === j.primary_email_address_id) ?? list[0];
    const email = cleanEmail(pick?.email_address);
    await env.DB.prepare("UPDATE users SET email = ?, email_at = ? WHERE id = ?").bind(email, iso(now), userId).run();
    return email;
  } catch {
    return u?.email ?? null;
  }
}

/* ---------- the emails themselves ---------- */

export const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nl = (s: string) => escHtml(s).replace(/\r?\n/g, "<br>");

interface Layout { preheader: string; heading: string; paragraphs: string[]; quote?: string; button?: { label: string; url: string }; small?: string[]; footer: string; unsubscribeUrl: string }

function render(l: Layout): { html: string; text: string } {
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#4A0E1F">${nl(t)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FFF8F0">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escHtml(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #F3DCCB">
<tr><td style="padding:30px 28px 26px;font-family:Helvetica,Arial,sans-serif">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#4A0E1F;margin:0 0 18px">${escHtml(l.heading)}</div>
${l.paragraphs.map(p).join("")}
${l.quote ? `<div style="margin:6px 0 18px;padding:12px 16px;border-left:3px solid #E11D48;background:#FFF8F0;border-radius:6px;font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.5;color:#4A0E1F">${nl(l.quote)}</div>` : ""}
${l.button ? `<p style="margin:22px 0"><a href="${escHtml(l.button.url)}" style="display:inline-block;background:#E11D48;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 26px;border-radius:999px">${escHtml(l.button.label)}</a></p>` : ""}
${(l.small ?? []).map((t) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#8A6B73">${nl(t)}</p>`).join("")}
</td></tr></table>
<p style="max-width:520px;margin:16px auto 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8A6B73;text-align:center">${escHtml(l.footer)}<br><a href="${escHtml(l.unsubscribeUrl)}" style="color:#8A6B73">Stop emails like this</a></p>
</td></tr></table></body></html>`;
  const text = [l.heading, "", ...l.paragraphs.flatMap((t) => [t, ""]), ...(l.quote ? [`"${l.quote}"`, ""] : []), ...(l.button ? [`${l.button.label}: ${l.button.url}`, ""] : []), ...(l.small ?? []), "", l.footer, `Stop emails like this: ${l.unsubscribeUrl}`].join("\n");
  return { html, text };
}

interface PageLite { id: string; title: string; slug: string; password_hash?: string | null; unlock_at?: string | null; expires_at?: string | null }
const pageUrl = (origin: string, p: PageLite) => `${origin}/p/${p.slug}`;

export function deliveryEmail(o: { origin: string; page: PageLite; fromName: string; toName: string; note: string; unsubscribeUrl: string; now: number }) {
  const small: string[] = [];
  const unlock = o.page.unlock_at ? Date.parse(o.page.unlock_at) : NaN;
  if (!Number.isNaN(unlock) && unlock > o.now) small.push(`It opens on ${fmtDate(unlock, true)}. Before that, it stays closed.`);
  if (o.page.password_hash) small.push(`It is protected with a password. ${o.fromName} will tell you what it is.`);
  const end = o.page.expires_at ? Date.parse(o.page.expires_at) : NaN;
  if (!Number.isNaN(end)) small.push(`It can be opened until ${fmtDate(end, true)}.`);
  const r = render({
    preheader: `${o.fromName} made a page just for you.`,
    heading: o.toName ? `Hi ${o.toName},` : "Hello,",
    paragraphs: [`${o.fromName} made a little page just for you.`],
    quote: o.note || undefined,
    button: { label: "Open your page", url: pageUrl(o.origin, o.page) },
    small,
    footer: `You got this because ${o.fromName} asked MadeForYou to send it to you. MadeForYou helps people make free personal pages.`,
    unsubscribeUrl: o.unsubscribeUrl,
  });
  return { subject: `${o.fromName} made a page for you`, ...r };
}

export function eventReminderEmail(o: { origin: string; page: PageLite; ev: EventInfo; name: string; unsubscribeUrl: string }) {
  const small: string[] = [];
  if (o.ev.place) small.push(`Where: ${o.ev.place}`);
  if (o.ev.mapsLink) small.push(`Map: ${o.ev.mapsLink}`);
  if (o.ev.note) small.push(o.ev.note);
  const title = o.ev.title || o.page.title;
  const r = render({
    preheader: `${title}: ${fmtDate(o.ev.at, o.ev.hasTime)}`,
    heading: `Hi ${o.name}, a reminder`,
    paragraphs: [`${title} is coming up on ${fmtDate(o.ev.at, o.ev.hasTime)}.`, "You asked us to remind you when you replied on the page."],
    button: { label: "Open the page", url: pageUrl(o.origin, o.page) },
    small,
    footer: "This is the only reminder you will get for this event. MadeForYou helps people make free personal pages.",
    unsubscribeUrl: o.unsubscribeUrl,
  });
  return { subject: `Reminder: ${title}, ${fmtDate(o.ev.at, o.ev.hasTime)}`, ...r };
}

export function endingEmail(o: { origin: string; page: PageLite; endsAt: number; audience: "owner" | "recipient"; fromName?: string; unsubscribeUrl: string }) {
  const owner = o.audience === "owner";
  const when = fmtDate(o.endsAt, true);
  const r = render({
    preheader: `${owner ? "Your page" : "A page for you"} switches off on ${when}.`,
    heading: owner ? "Your page ends soon" : "This page ends soon",
    paragraphs: owner
      ? [`“${o.page.title}” switches off on ${when}. After that, anyone who opens the link sees that it has ended.`, "To keep it open longer, change the end date and update the page."]
      : [`${o.fromName ? `The page ${o.fromName} made for you` : "The page made for you"} switches off on ${when}. Open it before then if you want to see it again.`],
    button: owner ? { label: "Change the end date", url: `${o.origin}/#/publish/${o.page.id}` } : { label: "Open the page", url: pageUrl(o.origin, o.page) },
    footer: "MadeForYou helps people make free personal pages.",
    unsubscribeUrl: o.unsubscribeUrl,
  });
  return { subject: owner ? `Your page “${o.page.title}” ends soon` : `${o.fromName ? `${o.fromName}'s` : "Your"} page ends soon`, ...r };
}

/* ---------- 1. a page sent on a date ---------- */

interface DeliveryRow { id: string; page_id: string; owner_id: string; to_email: string; to_name: string | null; from_name: string; note: string | null; send_at: string; status: string; attempts: number }
interface PageRow { id: string; owner_id: string; title: string; slug: string | null; status: string; password_hash: string | null; unlock_at: string | null; expires_at: string | null; content: string }

/** Sends one waiting delivery. Safe to call twice: only the call that wins the claim sends. */
export async function deliverOne(env: Env, deps: Deps, origin: string, id: string): Promise<"sent" | "failed" | "retry" | "skipped"> {
  const now = deps.now();
  const won = await env.DB.prepare("UPDATE deliveries SET status = 'sending', claimed_at = ?, attempts = attempts + 1 WHERE id = ? AND status = 'scheduled'").bind(iso(now), id).run();
  if (won.meta?.changes !== 1) return "skipped";
  const d = await env.DB.prepare("SELECT * FROM deliveries WHERE id = ?").bind(id).first<DeliveryRow>();
  if (!d) return "skipped";
  const fail = async (msg: string) => {
    await env.DB.prepare("UPDATE deliveries SET status = 'failed', error = ? WHERE id = ?").bind(msg, id).run();
    return "failed" as const;
  };

  const p = await env.DB.prepare("SELECT * FROM pages WHERE id = ? AND deleted_at IS NULL").bind(d.page_id).first<PageRow>();
  if (!p || p.status !== "published" || !p.slug) return fail("The page was not published when it was time to send it");
  if (p.expires_at && Date.parse(p.expires_at) <= now) return fail("The page had already ended");
  if (await isBlocked(env, d.to_email)) return fail("This person asked not to get emails from MadeForYou");
  if ((await sentInLastDay(env, now)) >= DAILY_CAP) {
    await env.DB.prepare("UPDATE deliveries SET status = 'scheduled', attempts = attempts - 1, error = 'Daily email limit reached. It will be sent later.' WHERE id = ?").bind(id).run();
    return "retry";
  }

  const unsubscribeUrl = `${origin}/api/mail/unsub?t=${await unsubToken(env, d.to_email, now)}`;
  const mail = deliveryEmail({ origin, page: p as PageLite, fromName: d.from_name, toName: d.to_name ?? "", note: d.note ?? "", unsubscribeUrl, now });
  try {
    await sendMail(env, deps, { to: d.to_email, toName: d.to_name ?? undefined, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl });
  } catch (e) {
    const err = e as MailError;
    if (err.retry && d.attempts < MAX_TRIES) {
      await env.DB.prepare("UPDATE deliveries SET status = 'scheduled', error = ? WHERE id = ?").bind(err.message, id).run();
      return "retry";
    }
    return fail(err.message);
  }
  await claim(env, `dl:${id}`, now);
  await env.DB.prepare("UPDATE deliveries SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?").bind(iso(deps.now()), id).run();
  return "sent";
}

/* ---------- the scheduled job ---------- */

export interface TickResult { deliveries: number; reminders: number; ending: number; left: number }

export async function runTick(env: Env, deps: Deps, origin: string): Promise<TickResult> {
  const out: TickResult = { deliveries: 0, reminders: 0, ending: 0, left: 0 };
  if (!mailConfig(env)) return out;
  const now = deps.now();
  const budget = { n: Math.max(0, Math.min(PER_TICK, DAILY_CAP - (await sentInLastDay(env, now)))) };

  // a send that was claimed but never finished (the server stopped part-way) is tried again
  await env.DB.prepare("UPDATE deliveries SET status = 'scheduled' WHERE status = 'sending' AND claimed_at < ?").bind(iso(now - 10 * 60_000)).run();

  /* 1. pages that are due */
  const due = await env.DB.prepare("SELECT id FROM deliveries WHERE status = 'scheduled' AND send_at <= ? ORDER BY send_at LIMIT ?").bind(iso(now), budget.n).all<{ id: string }>();
  for (const r of due.results ?? []) {
    if (budget.n <= 0) break;
    budget.n--;
    if ((await deliverOne(env, deps, origin, r.id)) === "sent") out.deliveries++;
  }

  /* 2. one reminder to guests who left an email */
  if (budget.n > 0) {
    const subs = await env.DB.prepare(
      `SELECT s.id, s.page_id, s.payload, s.event_at FROM submissions s
        WHERE s.kind = 'rsvp' AND s.remind_at IS NOT NULL AND s.remind_at <= ? AND s.event_at > ?
          AND NOT EXISTS (SELECT 1 FROM mail_log m WHERE m.key = 'ev:' || s.id)
        ORDER BY s.event_at LIMIT ?`,
    ).bind(iso(now), iso(now), budget.n).all<{ id: string; page_id: string; payload: string; event_at: string }>();
    const pages = new Map<string, PageRow | null>();
    for (const s of subs.results ?? []) {
      if (budget.n <= 0) break;
      const key = `ev:${s.id}`;
      if (!pages.has(s.page_id)) pages.set(s.page_id, await env.DB.prepare("SELECT * FROM pages WHERE id = ? AND deleted_at IS NULL").bind(s.page_id).first<PageRow>());
      const p = pages.get(s.page_id);
      if (!p || p.status !== "published" || !p.slug || (p.expires_at && Date.parse(p.expires_at) <= now)) { await skip(env, key, now); continue; }
      const ev = nextEvent(JSON.parse(p.content) as Content, now);
      if (!ev) { await skip(env, key, now); continue; }
      if (ev.at !== Date.parse(s.event_at)) {
        // the owner moved the event: wait for the new time instead of reminding about the old one
        await env.DB.prepare("UPDATE submissions SET event_at = ?, remind_at = ? WHERE id = ?").bind(iso(ev.at), iso(Math.max(now, ev.at - DAY)), s.id).run();
        continue;
      }
      const pay = JSON.parse(s.payload) as { name?: string; email?: string; response?: string };
      const email = cleanEmail(pay.email);
      if (!email || pay.response === "no" || (await isBlocked(env, email))) { await skip(env, key, now); continue; }
      if (!(await claim(env, key, now))) continue;
      budget.n--;
      const unsubscribeUrl = `${origin}/api/mail/unsub?t=${await unsubToken(env, email, now)}`;
      const mail = eventReminderEmail({ origin, page: p as PageLite, ev, name: pay.name ?? "there", unsubscribeUrl });
      try {
        await sendMail(env, deps, { to: email, toName: pay.name, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl });
        out.reminders++;
      } catch (e) {
        if ((e as MailError).retry) await release(env, key);
        else await markUnsent(env, key);
      }
    }
  }

  /* 3. "this page ends soon", to the owner and to the people it was sent to */
  if (budget.n > 0) {
    const ending = await env.DB.prepare(
      "SELECT id, owner_id, title, slug, expires_at, password_hash, unlock_at FROM pages WHERE status = 'published' AND deleted_at IS NULL AND slug IS NOT NULL AND expires_at > ? AND expires_at <= ? ORDER BY expires_at LIMIT 15",
    ).bind(iso(now), iso(now + DAY)).all<PageRow>();
    for (const p of ending.results ?? []) {
      const endsAt = Date.parse(p.expires_at!);
      const people: { email: string; audience: "owner" | "recipient"; fromName?: string; id: string }[] = [];
      // the log key uses the delivery's id, never the address itself, so no email address is left behind in the log
      const rec = await env.DB.prepare("SELECT id, to_email, from_name FROM deliveries WHERE page_id = ? AND status = 'sent' ORDER BY sent_at").bind(p.id).all<{ id: string; to_email: string; from_name: string }>();
      const seen = new Set<string>();
      for (const r of rec.results ?? []) {
        if (seen.has(r.to_email)) continue; // one reminder per address, even if the page was sent to it twice
        seen.add(r.to_email);
        people.push({ email: r.to_email, audience: "recipient", fromName: r.from_name, id: r.id });
      }
      const owner = await ownerEmail(env, deps, p.owner_id, now);
      if (owner) people.push({ email: owner, audience: "owner", id: "owner" });
      for (const who of people) {
        if (budget.n <= 0) break;
        const key = `end:${p.id}:${p.expires_at}:${who.id}`;
        if (await isBlocked(env, who.email)) { await skip(env, key, now); continue; }
        if (!(await claim(env, key, now))) continue;
        budget.n--;
        const unsubscribeUrl = `${origin}/api/mail/unsub?t=${await unsubToken(env, who.email, now)}`;
        const mail = endingEmail({ origin, page: p as PageLite, endsAt, audience: who.audience, fromName: who.fromName, unsubscribeUrl });
        try {
          await sendMail(env, deps, { to: who.email, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl });
          out.ending++;
        } catch (e) {
          if ((e as MailError).retry) await release(env, key);
          else await markUnsent(env, key);
        }
      }
    }
  }

  out.left = budget.n;
  return out;
}

/* ---------- a note to the site owner when a page is reported ---------- */

export async function notifyReport(env: Env, deps: Deps, o: { origin: string; slug: string; title: string; reason: string; details: string; contact: string; count: number }): Promise<void> {
  const to = cleanEmail(env.REPORT_EMAIL ?? "") ?? mailConfig(env)?.from;
  if (!to || !mailConfig(env)) return;
  const link = `${o.origin}/#/admin`;
  const lines = [`Page: ${o.title} (${o.origin}/p/${o.slug})`, `Reason: ${o.reason}`, o.details ? `Details: ${o.details}` : "", o.contact ? `Reporter: ${o.contact}` : "", `Reports on this page so far: ${o.count}`].filter(Boolean);
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#4A0E1F;line-height:1.5"><h2 style="font-family:Georgia,serif">A page was reported</h2>${lines.map((l) => `<p style="margin:0 0 8px">${escHtml(l)}</p>`).join("")}<p><a href="${escHtml(link)}">Open the review page</a></p></div>`;
  try {
    await sendMail(env, deps, { to, subject: `Page reported: ${o.title}`.slice(0, 120), html, text: `${lines.join("\n")}\n\nReview: ${link}` });
  } catch {
    /* the report is saved either way; it will be waiting in the review page */
  }
}
