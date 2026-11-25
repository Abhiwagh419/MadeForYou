import { cleanEmail, type Content } from "@madeforyou/schema";
import { readToken, signToken } from "./crypto";
import { escHtml, render, type Fact, type Tone } from "./mailLayout";
import type { Deps, Env } from "./types";

export { escHtml };

export const DAILY_CAP = 280; // brevo free plan is 300 a day
const PER_TICK = 25;
const DAY = 86_400_000;
const MAX_TRIES = 4;

export interface MailConfig { key: string; from: string; fromName: string }

export function mailConfig(env: Env): MailConfig | null {
  const key = env.BREVO_API_KEY?.trim();
  const from = cleanEmail(env.MAIL_FROM ?? "");
  if (!key || !from) return null;
  return { key, from, fromName: (env.MAIL_FROM_NAME ?? "").trim().slice(0, 60) || "MadeForYou" };
}
export const remindersOn = (env: Env) => !!mailConfig(env) && !!env.CRON_SECRET?.trim();

export class MailError extends Error {
  constructor(message: string, public retry: boolean) {
    super(message);
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

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
  } catch {}
  throw new MailError(`The email service refused it (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`, res.status >= 500 || res.status === 429);
}

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
  await env.DB.prepare("UPDATE deliveries SET status = 'cancelled', error = 'This person asked not to get emails' WHERE to_email = ? AND status IN ('scheduled', 'sending')").bind(email).run();
}

const claim = async (env: Env, key: string, now: number) =>
  (await env.DB.prepare("INSERT INTO mail_log (key, at, sent) VALUES (?, ?, 1) ON CONFLICT(key) DO NOTHING").bind(key, iso(now)).run()).meta?.changes === 1;
const release = (env: Env, key: string) => env.DB.prepare("DELETE FROM mail_log WHERE key = ?").bind(key).run();
const markUnsent = (env: Env, key: string) => env.DB.prepare("UPDATE mail_log SET sent = 0 WHERE key = ?").bind(key).run();
const skip = (env: Env, key: string, now: number) => env.DB.prepare("INSERT INTO mail_log (key, at, sent) VALUES (?, ?, 0) ON CONFLICT(key) DO NOTHING").bind(key, iso(now)).run();

export async function sentInLastDay(env: Env, now: number): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM mail_log WHERE sent = 1 AND at > ?").bind(iso(now - DAY)).first<{ n: number }>();
  return r?.n ?? 0;
}

export function eventStart(when: unknown): number | null {
  if (typeof when !== "string" || !when.trim()) return null;
  let v = when.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += "T00:00:00+05:30";
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) v += "+05:30";
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

export interface EventInfo { at: number; hasTime: boolean; title: string; place: string; mapsLink: string; note: string }

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

interface PageLite { id: string; title: string; slug: string; password_hash?: string | null; unlock_at?: string | null; expires_at?: string | null }
const pageUrl = (origin: string, p: PageLite) => `${origin}/p/${p.slug}`;

export function deliveryEmail(o: { origin: string; page: PageLite; fromName: string; toName: string; note: string; unsubscribeUrl: string; now: number }) {
  const notes: string[] = [];
  const unlock = o.page.unlock_at ? Date.parse(o.page.unlock_at) : NaN;
  if (!Number.isNaN(unlock) && unlock > o.now) notes.push(`It opens on ${fmtDate(unlock, true)}. Before that, it stays closed.`);
  if (o.page.password_hash) notes.push(`It is protected with a password. ${o.fromName} will tell you what it is.`);
  const end = o.page.expires_at ? Date.parse(o.page.expires_at) : NaN;
  if (!Number.isNaN(end)) notes.push(`It can be opened until ${fmtDate(end, true)}.`);
  const r = render({
    preheader: `${o.fromName} made a page just for you.`,
    badge: { label: "A page for you", tone: "rose" },
    heading: o.toName ? `Hi ${o.toName},` : "Hello,",
    paragraphs: [`${o.fromName} made a little page just for you.`, "It is a few minutes of something personal. Open it on your phone whenever you are ready."],
    quote: o.note ? { label: `A note from ${o.fromName}`, text: o.note } : undefined,
    notes,
    button: { label: "Open your page", url: pageUrl(o.origin, o.page) },
    footer: `You got this because ${o.fromName} asked MadeForYou to send it to you. MadeForYou helps people make free personal pages.`,
    unsubscribeUrl: o.unsubscribeUrl,
  });
  return { subject: `${o.fromName} made a page for you`, ...r };
}

export function eventReminderEmail(o: { origin: string; page: PageLite; ev: EventInfo; name: string; unsubscribeUrl: string }) {
  const title = o.ev.title || o.page.title;
  const when = fmtDate(o.ev.at, o.ev.hasTime);
  const facts: Fact[] = [{ label: "What", value: title }, { label: "When", value: when }];
  if (o.ev.place) facts.push({ label: "Where", value: o.ev.place });
  if (o.ev.mapsLink) facts.push({ label: "Map", value: "Open in Maps", href: o.ev.mapsLink });
  if (o.ev.note) facts.push({ label: "Note", value: o.ev.note });
  const r = render({
    preheader: `${title}: ${when}`,
    badge: { label: "Reminder", tone: "amber" },
    heading: `Hi ${o.name}, it is almost time`,
    paragraphs: [`${title} is coming up on ${when}.`, "You asked us to remind you when you replied on the page."],
    facts,
    button: { label: "Open the page", url: pageUrl(o.origin, o.page) },
    footer: "This is the only reminder you will get for this event. MadeForYou helps people make free personal pages.",
    unsubscribeUrl: o.unsubscribeUrl,
  });
  return { subject: `Reminder: ${title}, ${when}`, ...r };
}

export function endingEmail(o: { origin: string; page: PageLite; endsAt: number; audience: "owner" | "recipient"; fromName?: string; unsubscribeUrl: string }) {
  const owner = o.audience === "owner";
  const when = fmtDate(o.endsAt, true);
  const r = render({
    preheader: `${owner ? "Your page" : "A page for you"} switches off on ${when}.`,
    badge: { label: "Ending soon", tone: "amber" },
    heading: owner ? "Your page ends soon" : "This page ends soon",
    paragraphs: owner
      ? [`“${o.page.title}” switches off on ${when}. After that, anyone who opens the link sees that it has ended.`, "To keep it open longer, change the end date and update the page."]
      : [`${o.fromName ? `The page ${o.fromName} made for you` : "The page made for you"} switches off on ${when}. Open it before then if you want to see it again.`],
    facts: [{ label: "Page", value: o.page.title }, { label: "Switches off", value: when }],
    button: owner ? { label: "Change the end date", url: `${o.origin}/#/publish/${o.page.id}` } : { label: "Open the page", url: pageUrl(o.origin, o.page) },
    footer: "MadeForYou helps people make free personal pages.",
    unsubscribeUrl: o.unsubscribeUrl,
  });
  return { subject: owner ? `Your page “${o.page.title}” ends soon` : `${o.fromName ? `${o.fromName}'s` : "Your"} page ends soon`, ...r };
}

interface DeliveryRow { id: string; page_id: string; owner_id: string; to_email: string; to_name: string | null; from_name: string; note: string | null; send_at: string; status: string; attempts: number }
interface PageRow { id: string; owner_id: string; title: string; slug: string | null; status: string; password_hash: string | null; unlock_at: string | null; expires_at: string | null; content: string }

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

  // mark it as sent before sending, so a crash can never cause a second email
  const key = `dl:${id}`;
  if (!(await claim(env, key, now))) return fail("The server stopped while sending this, so we cannot tell if it arrived. Please check with them, then send it again if needed.");
  const unsubscribeUrl = `${origin}/api/mail/unsub?t=${await unsubToken(env, d.to_email, now)}`;
  const mail = deliveryEmail({ origin, page: p as PageLite, fromName: d.from_name, toName: d.to_name ?? "", note: d.note ?? "", unsubscribeUrl, now });
  try {
    await sendMail(env, deps, { to: d.to_email, toName: d.to_name ?? undefined, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl });
  } catch (e) {
    await release(env, key);
    const err = e as MailError;
    if (err.retry && d.attempts < MAX_TRIES) {
      await env.DB.prepare("UPDATE deliveries SET status = 'scheduled', error = ? WHERE id = ?").bind(err.message, id).run();
      return "retry";
    }
    return fail(err.message);
  }
  await env.DB.prepare("UPDATE deliveries SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?").bind(iso(deps.now()), id).run();
  return "sent";
}

export interface TickResult { deliveries: number; reminders: number; ending: number; left: number }

export async function runTick(env: Env, deps: Deps, origin: string): Promise<TickResult> {
  const out: TickResult = { deliveries: 0, reminders: 0, ending: 0, left: 0 };
  if (!mailConfig(env)) return out;
  const now = deps.now();
  const budget = { n: Math.max(0, Math.min(PER_TICK, DAILY_CAP - (await sentInLastDay(env, now)))) };

  await env.DB.prepare("UPDATE deliveries SET status = 'scheduled' WHERE status = 'sending' AND claimed_at < ?").bind(iso(now - 10 * 60_000)).run();

  const due = await env.DB.prepare("SELECT id FROM deliveries WHERE status = 'scheduled' AND send_at <= ? ORDER BY send_at LIMIT ?").bind(iso(now), budget.n).all<{ id: string }>();
  for (const r of due.results ?? []) {
    if (budget.n <= 0) break;
    budget.n--;
    if ((await deliverOne(env, deps, origin, r.id)) === "sent") out.deliveries++;
  }

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

  if (budget.n > 0) {
    const ending = await env.DB.prepare(
      "SELECT id, owner_id, title, slug, expires_at, password_hash, unlock_at FROM pages WHERE status = 'published' AND deleted_at IS NULL AND slug IS NOT NULL AND expires_at > ? AND expires_at <= ? ORDER BY expires_at LIMIT 15",
    ).bind(iso(now), iso(now + DAY)).all<PageRow>();
    for (const p of ending.results ?? []) {
      const endsAt = Date.parse(p.expires_at!);
      const people: { email: string; audience: "owner" | "recipient"; fromName?: string; id: string }[] = [];
      const rec = await env.DB.prepare("SELECT id, to_email, from_name FROM deliveries WHERE page_id = ? AND status = 'sent' ORDER BY sent_at").bind(p.id).all<{ id: string; to_email: string; from_name: string }>();
      const seen = new Set<string>();
      for (const r of rec.results ?? []) {
        if (seen.has(r.to_email)) continue;
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

export async function notifyReport(env: Env, deps: Deps, o: { origin: string; slug: string; title: string; reason: string; details: string; contact: string; count: number }): Promise<void> {
  const to = cleanEmail(env.REPORT_EMAIL ?? "") ?? mailConfig(env)?.from;
  if (!to || !mailConfig(env)) return;
  const link = `${o.origin}/#/admin`;
  const facts: Fact[] = [
    { label: "Page", value: o.title, href: `${o.origin}/p/${o.slug}` },
    { label: "Reason", value: o.reason },
  ];
  if (o.details) facts.push({ label: "Details", value: o.details });
  if (o.contact) facts.push({ label: "Reporter", value: o.contact, href: cleanEmail(o.contact) ? `mailto:${o.contact}` : undefined });
  facts.push({ label: "Reports so far", value: String(o.count) });
  const mail = render({
    preheader: `${o.title} was reported: ${o.reason}`,
    badge: { label: "Needs review", tone: "rose" },
    heading: "A page was reported",
    paragraphs: ["Someone flagged a page on MadeForYou. Have a look and decide whether it stays online."],
    facts,
    button: { label: "Open the review page", url: link },
    footer: "You get this because you look after MadeForYou.",
  });
  try {
    await sendMail(env, deps, { to, subject: `Page reported: ${o.title}`.slice(0, 120), html: mail.html, text: mail.text });
  } catch {}
}

const REPORT_REASON_WORDS: Record<string, string> = {
  abuse: "it is hurtful, threatening or unlawful",
  private: "it shows someone's private details without their consent",
  copyright: "it uses a photo, music or writing without permission",
  spam: "it looks like spam or a scam",
  other: "something else",
};
export const contactAddress = (env: Env) => cleanEmail(env.REPORT_EMAIL ?? "") ?? mailConfig(env)?.from ?? "";

export const reportReasonWords = (reason: string) => REPORT_REASON_WORDS[reason] ?? reason;

interface Notice { badge: { label: string; tone: Tone }; facts?: Fact[]; button?: { label: string; url: string } }

async function sendNotice(env: Env, deps: Deps, to: string, subject: string, heading: string, paragraphs: string[], quote: { label: string; text: string } | undefined, extra: Notice): Promise<void> {
  const mail = render({
    preheader: paragraphs[0] ?? heading,
    badge: extra.badge,
    heading,
    paragraphs,
    quote,
    facts: extra.facts,
    button: extra.button,
    footer: "MadeForYou helps people make free personal pages.",
  });
  try {
    await sendMail(env, deps, { to, subject: subject.slice(0, 120), html: mail.html, text: mail.text });
  } catch {}
}

export async function notifyOwnerReported(env: Env, deps: Deps, o: { ownerId: string; title: string; slug: string; reason: string; origin: string; contactEmail: string }): Promise<void> {
  if (!mailConfig(env)) return;
  const to = await ownerEmail(env, deps, o.ownerId, deps.now());
  if (!to || (await isBlocked(env, to))) return;
  await sendNotice(env, deps, to, `Your page was reported: ${o.title}`, "Someone reported your page", [
    `Your page “${o.title}” (${o.origin}/p/${o.slug}) was reported because ${reportReasonWords(o.reason)}.`,
    "It is still online while we take a look. We will write to you again with what we decide, and why.",
    ...(o.contactEmail ? [`If you have something to tell us about it, write to ${o.contactEmail}.`] : []),
  ], undefined, {
    badge: { label: "Report received", tone: "amber" },
    facts: [{ label: "Page", value: o.title, href: `${o.origin}/p/${o.slug}` }, { label: "Status", value: "Still online while we review it" }],
    button: { label: "Open your page", url: `${o.origin}/p/${o.slug}` },
  });
}

export async function notifyDecision(
  env: Env,
  deps: Deps,
  o: { decision: "removed" | "dismissed"; note: string; title: string; slug: string; ownerId: string; origin: string; contactEmail: string; reporters: (string | null)[] },
): Promise<void> {
  if (!mailConfig(env)) return;
  const removed = o.decision === "removed";
  const note = o.note.trim();

  const seen = new Set<string>();
  for (const raw of o.reporters) {
    const to = cleanEmail(raw ?? "");
    if (!to || seen.has(to) || (await isBlocked(env, to))) continue;
    seen.add(to);
    await sendNotice(
      env, deps, to,
      removed ? `We took the page down: ${o.title}` : `About your report: ${o.title}`,
      removed ? "Thank you. We took the page down" : "Thank you for your report",
      [
        removed
          ? `You reported the page “${o.title}”. We looked at it and took it down.`
          : `You reported the page “${o.title}”. We looked at it and decided to leave it online.`,
        ...(note ? [] : ["We did not add a note."]),
      ],
      note ? { label: "Our reason", text: note } : undefined,
      {
        badge: removed ? { label: "Page removed", tone: "rose" } : { label: "Report reviewed", tone: "green" },
        facts: [{ label: "Page", value: o.title }, { label: "Decision", value: removed ? "Taken down" : "Left online" }],
      },
    );
  }

  const to = await ownerEmail(env, deps, o.ownerId, deps.now());
  if (to && !(await isBlocked(env, to))) {
    await sendNotice(
      env, deps, to,
      removed ? `Your page was taken down: ${o.title}` : `Your page stays online: ${o.title}`,
      removed ? "We took your page down" : "Your page stays online",
      removed
        ? [`After a report, we looked at “${o.title}” and took it down. It can no longer be opened, and it cannot be published again for now.`, ...(o.contactEmail ? [`If you think this was a mistake, write to ${o.contactEmail}.`] : [])]
        : [`Someone reported “${o.title}” (${o.origin}/p/${o.slug}). We looked at it and decided there was nothing wrong. It stays online and you do not need to do anything.`],
      note ? { label: "Our reason", text: note } : undefined,
      {
        badge: removed ? { label: "Page removed", tone: "rose" } : { label: "Page stays online", tone: "green" },
        facts: [{ label: "Page", value: o.title }, { label: "Decision", value: removed ? "Taken down" : "Left online" }],
        button: removed ? undefined : { label: "Open your page", url: `${o.origin}/p/${o.slug}` },
      },
    );
  }
}
