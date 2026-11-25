import { beforeEach, describe, expect, it } from "vitest";
import { createBlock, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { makeClient, makeEnv } from "../src/testing";

const SECRET_TEXT = "A secret surprise plan for Priya's party.";

function party(moderation: "review" | "auto" = "review"): Content {
  let c = starterSkeleton();
  const [hero, text, , sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", SECRET_TEXT);
  c = setField(c, sig!.id, "name", "Abhi");
  c = { ...c, blocks: c.blocks.filter((b) => b.type !== "gallery") };
  const wall = createBlock("wishes");
  wall.fields.title = "Wishes for Priya";
  wall.fields.prompt = "Say something nice";
  wall.fields.moderation = moderation;
  wall.ph = [];
  const reply = createBlock("replyBox");
  const rsvp = createBlock("rsvp");
  reply.ph = [];
  rsvp.ph = [];
  return { ...c, blocks: [...c.blocks.slice(0, 2), wall, reply, rsvp, ...c.blocks.slice(2)] };
}

let env: ReturnType<typeof makeEnv>;
let call: ReturnType<typeof makeClient>;
let t = 1_790_000_000_000;
const ids = (c: Content) => ({ wall: c.blocks.find((b) => b.type === "wishes")!.id, reply: c.blocks.find((b) => b.type === "replyBox")!.id, rsvp: c.blocks.find((b) => b.type === "rsvp")!.id });
let content: Content;
let n = 0;
const fresh = () => ({ "cf-connecting-ip": `10.0.0.${++n}` });

beforeEach(() => {
  env = makeEnv();
  t = 1_790_000_000_000;
  call = makeClient(env, { now: () => t });
  content = party();
  n = 0;
});

async function publishParty(c: Content = content, body: object = {}) {
  await call("PUT", "/pages/pg_party001", { user: "abhi", json: { title: "Priya's party", content: c } });
  const r = await call("POST", "/pages/pg_party001/publish", { user: "abhi", json: { slug: "priya", ...body } });
  expect(r.status).toBe(200);
}
const open = async () => (await call("GET", "/p/priya")).json;
const send = (token: string, kind: string, blockId: string, payload: object, extra: object = {}, headers: Record<string, string> = fresh()) =>
  call("POST", "/p/priya/submit", { json: { token, kind, blockId, payload, ...extra }, headers });
const inbox = async () => (await call("GET", "/me/inbox?page=pg_party001", { user: "abhi" })).json.submissions as any[];

describe("wishes", () => {
  it("a visitor's wish waits for the owner's approval, then appears on the wall", async () => {
    await publishParty();
    const page = await open();
    const r = await send(page.assetToken, "wish", ids(content).wall, { name: "Meera", message: "Happy birthday!" });
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("pending");
    expect((await open()).wishes[ids(content).wall] ?? []).toHaveLength(0);

    const [w] = await inbox();
    expect(w.kind).toBe("wish");
    expect(w.payload).toEqual({ name: "Meera", message: "Happy birthday!" });
    expect((await call("PATCH", `/submissions/${w.id}`, { user: "abhi", json: { status: "approved" } })).status).toBe(200);

    const shown = (await open()).wishes[ids(content).wall];
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ name: "Meera", message: "Happy birthday!" });
    expect(JSON.stringify(shown)).not.toMatch(/ip_hash|payload/);

    await call("PATCH", `/submissions/${w.id}`, { user: "abhi", json: { status: "rejected" } });
    expect((await open()).wishes[ids(content).wall] ?? []).toHaveLength(0);
  });
  it("auto-approve shows the wish straight away", async () => {
    content = party("auto");
    await publishParty(content);
    const page = await open();
    const r = await send(page.assetToken, "wish", ids(content).wall, { name: "Raj", message: "Cheers!" });
    expect(r.json.status).toBe("approved");
    expect((await open()).wishes[ids(content).wall]).toHaveLength(1);
  });
});

describe("who may leave a message", () => {
  it("needs the token a visitor gets only after passing the gates", async () => {
    await publishParty(content, { password: "zq7-secret" });
    expect((await send("", "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(403);
    expect((await send("garbage", "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(403);
    const opened = await call("POST", "/p/priya/open", { json: { password: "zq7-secret" } });
    expect((await send(opened.json.assetToken, "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(200);
  });
  it("a token for another page does not work", async () => {
    await publishParty();
    await call("PUT", "/pages/pg_other001", { user: "sam", json: { title: "Other", content: party() } });
    await call("POST", "/pages/pg_other001/publish", { user: "sam", json: { slug: "other" } });
    const other = (await call("GET", "/p/other")).json;
    expect((await send(other.assetToken, "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(403);
  });
  it("an ended page takes no more messages; a private page is invisible", async () => {
    await publishParty(content, { expiresAt: new Date(t + 60_000).toISOString() });
    const page = await open();
    t += 120_000;
    expect((await send(page.assetToken, "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(410);
    await call("POST", "/pages/pg_party001/unpublish", { user: "abhi" });
    expect((await send(page.assetToken, "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(404);
  });
});

describe("what is accepted", () => {
  it("refuses boxes that are not on the page, and the wrong kind for a box", async () => {
    await publishParty();
    const { assetToken: tok } = await open();
    expect((await send(tok, "wish", "blk_nothere", { name: "A", message: "B" })).status).toBe(400);
    expect((await send(tok, "reply", ids(content).wall, { message: "B" })).status).toBe(400);
    expect((await send(tok, "wish", ids(content).wall, { name: "", message: "B" })).status).toBe(400);
    expect((await send(tok, "wish", ids(content).wall, { name: "A", message: "x".repeat(900) })).status).toBe(200);
    expect((await inbox())[0].payload.message).toHaveLength(500);
    expect((await send(tok, "dance", ids(content).wall, {})).status).toBe(400);
  });
  it("silently drops a bot that fills the hidden field, and rejects a form filled in under 1.5 seconds", async () => {
    await publishParty();
    const { assetToken: tok } = await open();
    const bot = await send(tok, "wish", ids(content).wall, { name: "Bot", message: "Buy pills" }, { website: "http://spam.example" });
    expect(bot.status).toBe(200);
    expect(await inbox()).toHaveLength(0);
    expect((await send(tok, "wish", ids(content).wall, { name: "Bot", message: "x" }, { elapsedMs: 300 })).status).toBe(429);
    expect((await send(tok, "wish", ids(content).wall, { name: "Human", message: "x" }, { elapsedMs: 4000 })).status).toBe(200);
  });
  it("limits one visitor to five messages in ten minutes, and a page to forty an hour", async () => {
    await publishParty();
    const { assetToken: tok } = await open();
    const same = { "cf-connecting-ip": "9.9.9.9" };
    for (let i = 0; i < 5; i++) expect((await send(tok, "wish", ids(content).wall, { name: "A", message: `m${i}` }, {}, same)).status).toBe(200);
    expect((await send(tok, "wish", ids(content).wall, { name: "A", message: "6th" }, {}, same)).status).toBe(429);
    t += 11 * 60_000;
    expect((await send(tok, "wish", ids(content).wall, { name: "A", message: "later" }, {}, same)).status).toBe(200);
    for (let i = 0; i < 34; i++) await send(tok, "wish", ids(content).wall, { name: "B", message: `x${i}` });
    expect((await send(tok, "wish", ids(content).wall, { name: "C", message: "too many" })).status).toBe(429);
  });
  it("checks a Turnstile challenge when one is configured", async () => {
    env = makeEnv({ TURNSTILE_SECRET: "ts-secret" });
    const seen: string[] = [];
    call = makeClient(env, { now: () => t, fetch: (async (_u: unknown, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      seen.push(body);
      return new Response(JSON.stringify({ success: body.includes("response=good") }));
    }) as typeof fetch });
    await publishParty();
    const { assetToken: tok } = await open();
    expect((await send(tok, "wish", ids(content).wall, { name: "A", message: "B" })).status).toBe(403);
    expect((await send(tok, "wish", ids(content).wall, { name: "A", message: "B" }, { turnstile: "bad" })).status).toBe(403);
    expect((await send(tok, "wish", ids(content).wall, { name: "A", message: "B" }, { turnstile: "good" })).status).toBe(200);
    expect(seen.some((b) => b.includes("secret=ts-secret"))).toBe(true);
  });
});

describe("replies and RSVPs", () => {
  it("a reply goes only to the owner, and can be marked read", async () => {
    await publishParty();
    const { assetToken: tok } = await open();
    await send(tok, "reply", ids(content).reply, { message: "I cried. Thank you." });
    expect((await open()).wishes).toEqual({});
    expect(JSON.stringify(await open())).not.toContain("I cried");
    const sum = (await call("GET", "/me/inbox/summary", { user: "abhi" })).json.pages.pg_party001;
    expect(sum.unread).toBe(1);
    const [r] = await inbox();
    await call("PATCH", `/submissions/${r.id}`, { user: "abhi", json: { read: true } });
    expect((await call("GET", "/me/inbox/summary", { user: "abhi" })).json.pages.pg_party001.unread).toBe(0);
    expect((await inbox())[0].read).toBe(true);
  });
  it("RSVPs are counted, and answering again replaces the earlier answer", async () => {
    await publishParty();
    const { assetToken: tok } = await open();
    const rsvp = (p: object) => send(tok, "rsvp", ids(content).rsvp, p);
    await rsvp({ name: "Raj", response: "yes", guests: 3 });
    await rsvp({ name: "Sneha", response: "no" });
    await rsvp({ name: "Dev", response: "maybe", guests: 2 });
    await rsvp({ name: "raj", response: "yes", guests: 2 });
    const sum = (await call("GET", "/me/inbox/summary", { user: "abhi" })).json.pages.pg_party001;
    expect(sum).toMatchObject({ yes: 1, no: 1, maybe: 1, guests: 4 });
    expect((await inbox()).filter((s) => s.kind === "rsvp")).toHaveLength(3);
  });
});

describe("the inbox belongs to its owner", () => {
  it("nobody else can read, change or delete messages", async () => {
    await publishParty();
    const { assetToken: tok } = await open();
    await send(tok, "wish", ids(content).wall, { name: "A", message: "B" });
    const [w] = await inbox();
    expect((await call("GET", "/me/inbox?page=pg_party001", { user: "mallory" })).status).toBe(404);
    expect((await call("PATCH", `/submissions/${w.id}`, { user: "mallory", json: { status: "approved" } })).status).toBe(404);
    expect((await call("DELETE", `/submissions/${w.id}`, { user: "mallory" })).status).toBe(404);
    expect((await call("GET", "/me/inbox")).status).toBe(401);
    expect((await call("GET", "/me/inbox/summary", { user: "mallory" })).json.pages).toEqual({});
    expect((await call("DELETE", `/submissions/${w.id}`, { user: "abhi" })).status).toBe(200);
    expect(await inbox()).toHaveLength(0);
  });
});

describe("contributor links (friends add wishes without seeing the page)", () => {
  const link = async () => (await call("POST", "/pages/pg_party001/contributor-link", { user: "abhi" })).json.path as string;
  const k = (p: string) => p.split("?k=")[1]!;

  it("works while the page is locked, and shows only the wall's heading, never the page", async () => {
    await publishParty(content, { unlockAt: new Date(t + 86_400_000).toISOString(), password: "zq7-secret" });
    const path = await link();
    const info = await call("GET", `/c/priya?k=${k(path)}`);
    expect(info.status).toBe(200);
    expect(info.json).toMatchObject({ blockId: ids(content).wall, heading: "Wishes for Priya", prompt: "Say something nice", recipient: "Priya" });
    for (const s of [SECRET_TEXT, "Happy Birthday Priya", "Abhi"]) expect(info.text).not.toContain(s);

    const sent = await call("POST", `/c/priya/submit?k=${k(path)}`, { json: { payload: { name: "Meera", message: "Surprise!" } }, headers: fresh() });
    expect(sent.status).toBe(200);
    expect(sent.json.status).toBe("pending");
    const [w] = await inbox();
    expect(w).toMatchObject({ source: "contributor", status: "pending", payload: { name: "Meera", message: "Surprise!" } });
    expect((await call("GET", "/p/priya")).json.state).toBe("locked");
  });
  it("refuses a missing, wrong or old link; resetting kills every link sent so far", async () => {
    await publishParty();
    const path = await link();
    expect((await call("GET", "/c/priya")).status).toBe(404);
    expect((await call("GET", "/c/priya?k=garbage")).status).toBe(404);
    expect((await call("GET", `/c/priya?k=${k(path)}`)).status).toBe(200);
    await call("POST", "/pages/pg_party001/contributor-link/reset", { user: "abhi" });
    expect((await call("GET", `/c/priya?k=${k(path)}`)).status).toBe(404);
    expect((await call("POST", `/c/priya/submit?k=${k(path)}`, { json: { payload: { name: "A", message: "B" } } })).status).toBe(404);
    const fresh2 = await link();
    expect((await call("GET", `/c/priya?k=${k(fresh2)}`)).status).toBe(200);
  });
  it("only the owner can make a link, only for a published page with a wishes wall", async () => {
    await call("PUT", "/pages/pg_party001", { user: "abhi", json: { title: "x", content } });
    expect((await call("POST", "/pages/pg_party001/contributor-link", { user: "abhi" })).status).toBe(409);
    await call("POST", "/pages/pg_party001/publish", { user: "abhi", json: { slug: "priya" } });
    expect((await call("POST", "/pages/pg_party001/contributor-link", { user: "mallory" })).status).toBe(404);
    const plain = starterSkeleton();
    plain.blocks.forEach((b) => (b.ph = []));
    let c = plain;
    c = setField(c, c.blocks[0]!.id, "recipient", "X");
    c = setField(c, c.blocks[0]!.id, "title", "Y");
    c = setField(c, c.blocks[1]!.id, "body", "z");
    c = setField(c, c.blocks[2]!.id, "items", [{ image: { asset: "ast_nothing1" } }]);
    c = setField(c, c.blocks[3]!.id, "name", "W");
    await call("PUT", "/pages/pg_plain001", { user: "abhi", json: { title: "Plain", content: c } });
    await call("POST", "/pages/pg_plain001/publish", { user: "abhi", json: { slug: "plain" } });
    expect((await call("POST", "/pages/pg_plain001/contributor-link", { user: "abhi" })).status).toBe(409);
  });
  it("a link stops working after 90 days, and a contributor cannot leave anything but a wish", async () => {
    await publishParty();
    const path = await link();
    const sent = await call("POST", `/c/priya/submit?k=${k(path)}`, { json: { kind: "rsvp", blockId: ids(content).rsvp, payload: { name: "A", message: "Hello", response: "yes" } }, headers: fresh() });
    expect(sent.status).toBe(200);
    expect((await inbox())[0]).toMatchObject({ kind: "wish", blockId: ids(content).wall, payload: { name: "A", message: "Hello" } });
    expect((await call("POST", `/c/priya/submit?k=${k(path)}`, { json: { payload: { name: "A", response: "yes" } }, headers: fresh() })).status).toBe(400);
    t += 91 * 86_400_000;
    expect((await call("GET", `/c/priya?k=${k(path)}`)).status).toBe(404);
  });
});

describe("voice notes", () => {
  const webm = () => { const b = new Uint8Array(3000); b.set([0x1a, 0x45, 0xdf, 0xa3]); for (let i = 4; i < b.length; i++) b[i] = i % 251; return b; };
  const mp4 = () => { const b = new Uint8Array(400); b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]); return b; };
  const put = (id: string, bytes: Uint8Array, type: string) => call("PUT", `/assets/${id}`, { user: "abhi", body: bytes as unknown as BodyInit, headers: { "content-type": type } });

  it("accepts real audio, and refuses disguised files", async () => {
    expect((await put("ast_voice01", webm(), "audio/webm;codecs=opus")).status).toBe(200);
    expect((await put("ast_voice02", mp4(), "audio/mp4")).status).toBe(200);
    expect((await put("ast_voice03", new TextEncoder().encode("<script>alert(1)</script>"), "audio/webm")).status).toBe(415);
    expect((await put("ast_voice04", webm(), "audio/mp4")).status).toBe(415);
    expect((await put("ast_voice05", webm(), "video/webm")).status).toBe(415);
  });
  it("serves byte ranges, which Safari needs to play audio", async () => {
    await put("ast_voice01", webm(), "audio/webm");
    const tok = (await call("GET", "/me/token", { user: "abhi" })).json.token;
    const url = `/a/ast_voice01?t=${encodeURIComponent(tok)}`;
    const full = await call("GET", url);
    expect(full.status).toBe(200);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    const part = await makeApp()(url, { range: "bytes=100-199" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 100-199/3000");
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(webm().slice(100, 200));
    const tail = await makeApp()(url, { range: "bytes=2900-" });
    expect(tail.headers.get("content-range")).toBe("bytes 2900-2999/3000");
    const last = await makeApp()(url, { range: "bytes=-50" });
    expect(last.headers.get("content-range")).toBe("bytes 2950-2999/3000");
    expect((await makeApp()(url, { range: "bytes=5000-6000" })).status).toBe(416);
  });
  function makeApp() {
    return async (path: string, headers: Record<string, string>) => {
      const { createApp } = await import("../src");
      return createApp({ now: () => t }).request(`/api${path}`, { headers }, env);
    };
  }
});
