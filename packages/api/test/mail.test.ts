import { beforeEach, describe, expect, it } from "vitest";
import { createBlock, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { makeClient, makeEnv } from "../src/testing";
import { ownerEmail } from "../src/mail";

const H = 3_600_000;
const D = 24 * H;
const istLocal = (ms: number) => `${new Date(ms + 5.5 * H).toISOString().slice(0, 16)}:00+05:30`; // what the editor stores: India time with its offset

let env: ReturnType<typeof makeEnv>;
let call: ReturnType<typeof makeClient>;
let t = 1_790_000_000_000;
let sent: { headers: Record<string, string>; body: any }[] = [];
let brevo: number[] = []; // status codes to answer with, in order; empty means 201
let clerkCalls = 0;
let n = 0;
const fresh = () => ({ "cf-connecting-ip": `10.1.0.${++n}` });

const fetchStub = (async (url: string, init: RequestInit) => {
  const u = String(url);
  if (u.startsWith("https://api.brevo.com/v3/smtp/email")) {
    const status = brevo.shift() ?? 201;
    if (status >= 300) return new Response(JSON.stringify({ message: "stub says no" }), { status });
    sent.push({ headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response("{}", { status: 201 });
  }
  if (u.startsWith("https://api.clerk.com/v1/users/")) {
    clerkCalls++;
    return new Response(JSON.stringify({ primary_email_address_id: "ea2", email_addresses: [{ id: "ea1", email_address: "old@example.com" }, { id: "ea2", email_address: "Owner@Example.com" }] }), { status: 200 });
  }
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

const withMail = (extra: Record<string, string> = {}) => makeEnv({ BREVO_API_KEY: "xkeysib-test", MAIL_FROM: "hello@example.com", MAIL_FROM_NAME: "MadeForYou", CRON_SECRET: "cron-secret-123", CLERK_SECRET_KEY: "sk_test_abc", ...extra });
const boot = (e = withMail()) => {
  env = e;
  call = makeClient(env, { now: () => t, fetch: fetchStub });
};

beforeEach(() => {
  t = 1_790_000_000_000;
  sent = [];
  brevo = [];
  clerkCalls = 0;
  n = 0;
  boot();
});

function page(eventAt?: number): Content {
  let c = starterSkeleton();
  const [hero, text, , sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", "Hello Priya, this is for you.");
  c = setField(c, sig!.id, "name", "Abhi");
  c = { ...c, blocks: c.blocks.filter((b) => b.type !== "gallery") };
  const extra = [];
  if (eventAt !== undefined) {
    const ev = createBlock("event");
    ev.fields.title = "Priya's party";
    ev.fields.when = istLocal(eventAt);
    ev.fields.place = "Rooftop, Bandra";
    ev.ph = [];
    const rsvp = createBlock("rsvp");
    rsvp.ph = [];
    extra.push(ev, rsvp);
  }
  return { ...c, blocks: [...c.blocks.slice(0, 2), ...extra, ...c.blocks.slice(2)] };
}
const publish = async (c: Content = page(), body: object = {}) => {
  await call("PUT", "/pages/pg_mail0001", { user: "abhi", json: { title: "For Priya", content: c } });
  const r = await call("POST", "/pages/pg_mail0001/publish", { user: "abhi", json: { slug: "priya", ...body } });
  expect(r.status).toBe(200);
};
const tick = (secret = "cron-secret-123") => call("POST", "/cron/tick", { headers: { authorization: `Bearer ${secret}` } });
const deliver = (json: object, user = "abhi") => call("POST", "/pages/pg_mail0001/deliveries", { user, json });
const good = { toEmail: "Priya@Example.com", toName: "Priya", fromName: "Abhi", note: "Open it when you are ready." };
const rowOf = async (id: string) => (await env.DB.prepare("SELECT * FROM deliveries WHERE id = ?").bind(id).first()) as any;

describe("email is optional and says so", () => {
  it("reports that it is off, and refuses to send, when no sender is set", async () => {
    boot(makeEnv());
    expect((await call("GET", "/mail/status")).json).toMatchObject({ email: false, reminders: false });
    await publish();
    const r = await deliver(good);
    expect(r.status).toBe(503);
    expect(r.json.error).toMatch(/not switched on/i);
  });
  it("reports that it is on", async () => {
    expect((await call("GET", "/mail/status")).json).toMatchObject({ email: true, reminders: true, dailyLimit: 280 });
  });
});

describe("a page sent on a date", () => {
  it("waits until the time, then sends once with the right content", async () => {
    await publish(page(), { password: "secret1" });
    const r = await deliver({ ...good, note: "<script>alert(1)</script> Open it!", sendAt: new Date(t + 2 * H).toISOString() });
    expect(r.status).toBe(200);
    expect(r.json.delivery).toMatchObject({ status: "scheduled", toEmail: "priya@example.com", fromName: "Abhi" });
    expect(sent).toHaveLength(0);

    t += H;
    expect((await tick()).json).toMatchObject({ deliveries: 0 });
    expect(sent).toHaveLength(0);

    t += 2 * H;
    expect((await tick()).json).toMatchObject({ deliveries: 1 });
    expect(sent).toHaveLength(1);
    const m = sent[0]!;
    expect(m.headers["api-key"]).toBe("xkeysib-test");
    expect(m.body.sender).toEqual({ email: "hello@example.com", name: "MadeForYou" });
    expect(m.body.to).toEqual([{ email: "priya@example.com", name: "Priya" }]);
    expect(m.body.subject).toBe("Abhi made a page for you");
    expect(m.body.htmlContent).toContain("http://localhost/p/priya");
    expect(m.body.htmlContent).toContain("password");
    expect(m.body.htmlContent).not.toContain("<script>"); // the note is shown, never run
    expect(m.body.htmlContent).toContain("&lt;script&gt;");
    expect(m.body.textContent).toContain("http://localhost/p/priya");
    expect(m.body.headers["List-Unsubscribe"]).toMatch(/^<http:\/\/localhost\/api\/mail\/unsub\?t=/);
    expect(m.body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect((await rowOf(r.json.delivery.id)).status).toBe("sent");

    t += H;
    await tick();
    expect(sent).toHaveLength(1); // never twice
  });

  it("with no date, sends straight away", async () => {
    await publish();
    const r = await deliver(good);
    expect(r.json.delivery.status).toBe("sent");
    expect(sent).toHaveLength(1);
  });

  it("uses the main website address from PUBLIC_URL in links", async () => {
    boot(withMail({ PUBLIC_URL: "https://madeforyou-9pj.pages.dev/" }));
    await publish();
    await deliver(good);
    expect(sent[0]!.body.htmlContent).toContain("https://madeforyou-9pj.pages.dev/p/priya");
  });

  it("tells the person when the page opens", async () => {
    await publish(page(), { unlockAt: new Date(t + 3 * D).toISOString() });
    await deliver(good);
    expect(sent[0]!.body.htmlContent).toMatch(/It opens on/);
  });

  it("can be cancelled while waiting", async () => {
    await publish();
    const r = await deliver({ ...good, sendAt: new Date(t + 2 * H).toISOString() });
    expect((await call("DELETE", `/deliveries/${r.json.delivery.id}`, { user: "abhi" })).status).toBe(200);
    expect((await rowOf(r.json.delivery.id)).status).toBe("cancelled");
    t += 3 * H;
    await tick();
    expect(sent).toHaveLength(0);
  });

  it("only the owner can list or cancel", async () => {
    await publish();
    const r = await deliver({ ...good, sendAt: new Date(t + 2 * H).toISOString() });
    expect((await call("GET", "/pages/pg_mail0001/deliveries", { user: "mallory" })).status).toBe(404);
    expect((await call("DELETE", `/deliveries/${r.json.delivery.id}`, { user: "mallory" })).status).toBe(404);
    const list = await call("GET", "/pages/pg_mail0001/deliveries", { user: "abhi" });
    expect(list.json.deliveries).toHaveLength(1);
  });

  it("checks what it is given", async () => {
    await call("PUT", "/pages/pg_mail0001", { user: "abhi", json: { title: "For Priya", content: page() } });
    expect((await deliver(good)).status).toBe(409); // saved, but not published yet
    await publish();
    expect((await deliver({ ...good, toEmail: "not an email" })).status).toBe(400);
    expect((await deliver({ ...good, toEmail: "a@b.com\r\nBcc: x@y.com" })).status).toBe(400);
    expect((await deliver({ ...good, fromName: "" })).status).toBe(400);
    expect((await deliver({ ...good, sendAt: "later" })).status).toBe(400);
    expect((await deliver({ ...good, sendAt: new Date(t + 400 * D).toISOString() })).status).toBe(400);
  });

  it("refuses a time after the page has ended", async () => {
    await publish(page(), { expiresAt: new Date(t + 2 * D).toISOString() });
    expect((await deliver({ ...good, sendAt: new Date(t + 3 * D).toISOString() })).status).toBe(400);
  });

  it("limits how many people one page goes to, and duplicates", async () => {
    await publish();
    for (let i = 0; i < 5; i++) expect((await deliver({ ...good, toEmail: `p${i}@example.com`, sendAt: new Date(t + D).toISOString() })).status).toBe(200);
    expect((await deliver({ ...good, toEmail: "p9@example.com" })).status).toBe(409);
  });
  it("does not queue the same person twice", async () => {
    await publish();
    await deliver({ ...good, sendAt: new Date(t + D).toISOString() });
    expect((await deliver({ ...good, sendAt: new Date(t + 2 * D).toISOString() })).status).toBe(409);
  });

  it("tries again after a temporary failure, and gives up on a permanent one", async () => {
    await publish();
    brevo = [503];
    const r = await deliver(good);
    expect(r.json.delivery).toMatchObject({ status: "scheduled" });
    expect(r.json.delivery.error).toMatch(/503/);
    await tick();
    expect((await rowOf(r.json.delivery.id)).status).toBe("sent");

    const r2 = await call("POST", "/pages/pg_mail0001/deliveries", { user: "abhi", json: { ...good, toEmail: "other@example.com" } });
    expect(r2.status).toBe(200);
    brevo = [400];
    const r3 = await call("POST", "/pages/pg_mail0001/deliveries", { user: "abhi", json: { ...good, toEmail: "third@example.com" } });
    expect(r3.json.delivery.status).toBe("failed");
    expect(r3.json.delivery.error).toMatch(/refused/);
  });

  it("fails clearly if the page was taken down before the send", async () => {
    await publish();
    const r = await deliver({ ...good, sendAt: new Date(t + 2 * H).toISOString() });
    await call("POST", "/pages/pg_mail0001/unpublish", { user: "abhi" });
    t += 3 * H;
    await tick();
    const row = await rowOf(r.json.delivery.id);
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/not published/);
    expect(sent).toHaveLength(0);
  });

  it("waits when the daily limit is reached", async () => {
    await publish();
    const r = await deliver({ ...good, sendAt: new Date(t + H).toISOString() });
    for (let i = 0; i < 280; i++) await env.DB.prepare("INSERT INTO mail_log (key, at, sent) VALUES (?, ?, 1)").bind(`x${i}`, new Date(t + H).toISOString()).run();
    t += 2 * H;
    await tick();
    expect(sent).toHaveLength(0);
    expect((await rowOf(r.json.delivery.id)).status).toBe("scheduled");
    t += D; // a day later the log has aged out
    await tick();
    expect(sent).toHaveLength(1);
  });
});

describe("stop emails like this", () => {
  const tokenOf = () => /unsub\?t=([^>]+)>/.exec(sent[0]!.body.headers["List-Unsubscribe"])![1]!;
  it("asks first, then blocks the address for everyone", async () => {
    await publish();
    await deliver(good);
    const t1 = tokenOf();
    const ask = await call("GET", `/mail/unsub?t=${t1}`);
    expect(ask.status).toBe(200);
    expect(ask.text).toContain("priya@example.com");
    expect(await env.DB.prepare("SELECT 1 AS x FROM mail_blocks").first()).toBeNull(); // opening the link changes nothing
    const done = await call("POST", `/mail/unsub?t=${t1}`);
    expect(done.status).toBe(200);
    expect(await env.DB.prepare("SELECT email FROM mail_blocks").first()).toEqual({ email: "priya@example.com" });
    expect((await deliver({ ...good, sendAt: new Date(t + D).toISOString() })).status).toBe(400);
  });
  it("cancels what is still waiting for that address", async () => {
    await publish();
    await deliver(good); // sent now: this gives us a real stop link
    const waiting = await deliver({ ...good, sendAt: new Date(t + D).toISOString() });
    const other = await deliver({ ...good, toEmail: "other@example.com", sendAt: new Date(t + D).toISOString() });
    await call("POST", `/mail/unsub?t=${tokenOf()}`);
    expect((await rowOf(waiting.json.delivery.id)).status).toBe("cancelled");
    expect((await rowOf(other.json.delivery.id)).status).toBe("scheduled"); // a different address is untouched
  });
  it("rejects a forged or damaged link", async () => {
    expect((await call("GET", "/mail/unsub?t=nonsense")).status).toBe(400);
    expect((await call("POST", "/mail/unsub?t=unsub:abc.123.def")).status).toBe(400);
  });
});

describe("one reminder for guests", () => {
  const open = async () => (await call("GET", "/p/priya")).json;
  const rsvp = async (payload: object) => {
    const p = await open();
    const block = p.content.blocks.find((b: any) => b.type === "rsvp").id;
    return call("POST", "/p/priya/submit", { json: { token: p.assetToken, kind: "rsvp", blockId: block, payload }, headers: fresh() });
  };
  const yes = { name: "Meera", response: "yes", guests: 2, email: "Meera@Example.com" };

  it("tells the page it can ask for an email only when an event is coming", async () => {
    await publish(page());
    expect((await open()).canRemind).toBe(false);
    await publish(page(t + 3 * D));
    expect((await open()).canRemind).toBe(true);
  });

  it("sends one reminder a day before, then never again", async () => {
    await publish(page(t + 3 * D));
    expect((await rsvp(yes)).status).toBe(200);
    const saved = (await env.DB.prepare("SELECT payload, remind_at FROM submissions").first()) as any;
    expect(JSON.parse(saved.payload).email).toBe("meera@example.com");
    expect(saved.remind_at).toBe(new Date(Date.parse(istLocal(t + 3 * D)) - D).toISOString()); // a day before the event

    t += D;
    await tick();
    expect(sent).toHaveLength(0);

    t += D + H;
    expect((await tick()).json).toMatchObject({ reminders: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body.to[0].email).toBe("meera@example.com");
    expect(sent[0]!.body.subject).toContain("Priya's party");
    expect(sent[0]!.body.htmlContent).toContain("Rooftop, Bandra");
    await tick();
    expect(sent).toHaveLength(1);
  });

  it("does not keep an email from someone who said no, and rejects a bad one", async () => {
    await publish(page(t + 3 * D));
    await rsvp({ name: "Rohan", response: "no", email: "rohan@example.com" });
    const row = (await env.DB.prepare("SELECT payload, remind_at FROM submissions").first()) as any;
    expect(JSON.parse(row.payload).email).toBeUndefined();
    expect(row.remind_at).toBeNull();
    const bad = await rsvp({ name: "Asha", response: "yes", email: "asha at home" });
    expect(bad.status).toBe(400);
  });

  it("does not keep the address when reminders are not switched on", async () => {
    boot(withMail({ CRON_SECRET: "" }));
    await publish(page(t + 3 * D));
    await rsvp(yes);
    expect(JSON.parse(((await env.DB.prepare("SELECT payload FROM submissions").first()) as any).payload).email).toBeUndefined();
  });

  it("follows the event if the owner moves it", async () => {
    await publish(page(t + 3 * D));
    await rsvp(yes);
    await publish(page(t + 6 * D)); // moved three days later
    t += 2 * D + H; // the old reminder time
    await tick();
    expect(sent).toHaveLength(0);
    t += 3 * D;
    await tick();
    await tick();
    expect(sent).toHaveLength(1);
  });

  it("answering again replaces the earlier answer, so one reminder at most", async () => {
    await publish(page(t + 3 * D));
    await rsvp(yes);
    await rsvp(yes);
    expect(((await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions").first()) as any).n).toBe(1);
  });

  it("stops for someone who unsubscribed", async () => {
    await publish(page(t + 3 * D));
    await rsvp(yes);
    await env.DB.prepare("INSERT INTO mail_blocks (email, at) VALUES ('meera@example.com', 'x')").run();
    t += 2 * D + H;
    await tick();
    expect(sent).toHaveLength(0);
  });
});

describe("this page ends soon", () => {
  it("emails the owner and the people it was sent to, once, a day before", async () => {
    await env.DB.prepare("INSERT INTO users (id, created_at) VALUES ('dev_abhi', 'x') ON CONFLICT(id) DO NOTHING").run();
    await env.DB.prepare("UPDATE users SET email = 'owner@example.com', email_at = ? WHERE id = 'dev_abhi'").bind(new Date(t).toISOString()).run();
    await publish(page(), { expiresAt: new Date(t + 3 * D).toISOString() });
    await deliver(good);
    expect(sent).toHaveLength(1); // the delivery itself

    t += D;
    await tick();
    expect(sent).toHaveLength(1); // still two days to go

    t += D + 2 * H; // 22 hours left
    expect((await tick()).json).toMatchObject({ ending: 2 });
    const to = sent.slice(1).map((m) => m.body.to[0].email).sort();
    expect(to).toEqual(["owner@example.com", "priya@example.com"]);
    const ownerMail = sent.find((m) => m.body.to[0].email === "owner@example.com")!;
    expect(ownerMail.body.subject).toContain("ends soon");
    expect(ownerMail.body.htmlContent).toContain("/#/publish/pg_mail0001");
    const recipientMail = sent.find((m) => m.body.to[0].email === "priya@example.com")!;
    expect(recipientMail.body.htmlContent).toContain("http://localhost/p/priya");

    await tick();
    expect(sent).toHaveLength(3); // not again
  });

  it("does nothing for a page with no end date", async () => {
    await publish();
    await tick();
    expect(sent).toHaveLength(0);
  });
});

describe("the owner's email", () => {
  it("is looked up from Clerk once and remembered", async () => {
    await env.DB.prepare("INSERT INTO users (id, created_at) VALUES ('user_123', 'x')").run();
    const deps = { verify: async () => ({ sub: "x" }), now: () => t, fetch: fetchStub };
    expect(await ownerEmail(env, deps, "user_123", t)).toBe("owner@example.com");
    expect(await ownerEmail(env, deps, "user_123", t + D)).toBe("owner@example.com");
    expect(clerkCalls).toBe(1);
  });
});

describe("the scheduler's door", () => {
  it("only opens for the shared secret", async () => {
    expect((await call("POST", "/cron/tick")).status).toBe(401);
    expect((await tick("wrong")).status).toBe(401);
    expect((await tick()).status).toBe(200);
    boot(withMail({ CRON_SECRET: "" }));
    expect((await tick("")).status).toBe(503);
  });
});
