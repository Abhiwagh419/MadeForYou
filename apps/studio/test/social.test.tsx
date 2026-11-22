import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@madeforyou/api";
import { makeEnv } from "@madeforyou/api/testing";
import { createBlock, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { App, preloadScreens } from "../src/App";
import { apiRaw, setTokenGetter } from "../src/lib/api";
import { AuthProvider } from "../src/lib/auth";
import { saveAudio } from "../src/lib/assets";
import { csvCell, rsvpCsv } from "../src/lib/csv";
import { parseLocation } from "../src/lib/router";
import { wrapLines } from "../src/lib/story";
import { authRetry, publishRemote } from "../src/lib/sync";
import { createPage, getState, resetStore } from "../src/state/store";
import { VoiceRecorder } from "../src/ui/VoiceRecorder";

// Creator screens load on demand on the real site; load them all once so each test sees them straight away.
beforeAll(async () => { await preloadScreens(); }, 60_000);

function party(): Content {
  let c = starterSkeleton();
  const [hero, text, , sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", "A secret plan.");
  c = setField(c, sig!.id, "name", "Abhi");
  c = { ...c, blocks: c.blocks.filter((b) => b.type !== "gallery") };
  const wall = createBlock("wishes");
  wall.fields.title = "Wishes for Priya";
  wall.fields.prompt = "Say something nice";
  wall.ph = [];
  return { ...c, blocks: [...c.blocks.slice(0, 2), wall, ...c.blocks.slice(2)] };
}

let env: ReturnType<typeof makeEnv>;
let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  authRetry.delayMs = 10;
  vi.stubEnv("VITE_REMOTE", "1");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
  env = makeEnv();
  const app = createApp();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => app.request(typeof input === "string" ? input : (input as Request).url, init, env)) as typeof fetch;
  URL.createObjectURL = () => "blob:test";
  localStorage.clear();
  resetStore();
  setTokenGetter(async () => "dev:abhi");
  window.history.pushState({}, "", "/");
  window.location.hash = "";
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  vi.unstubAllEnvs();
  window.history.pushState({}, "", "/");
});

const settle = (ms = 120) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function visit(url: string, user?: string) {
  if (user) localStorage.setItem("mfy:dev-user", user);
  else localStorage.removeItem("mfy:dev-user");
  if (url.startsWith("#")) { window.history.pushState({}, "", "/"); window.location.hash = url; } // studio screens live at the root path
  else window.history.pushState({}, "", url);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<AuthProvider><App /></AuthProvider>));
  await settle(60);
}
async function leave() {
  await act(async () => root!.unmount());
  host!.remove();
}
const text = () => host!.textContent ?? "";
const q = (s: string) => host!.querySelector<HTMLElement>(s);
const qa = (s: string) => [...host!.querySelectorAll<HTMLElement>(s)];
const button = (label: string | RegExp) => qa("button, a").find((b) => (typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? "")))!;
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit(form: Element) {
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 60)); });
  // a slow computer takes longer: wait for the answer (thanks or an error) instead of guessing how long it takes
  for (let i = 0; i < 200 && !q(".mfy-thanks") && !q(".mfy-form-error") && !text().includes("Thank you"); i++) await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
}

async function publishParty() {
  const rec = createPage({ title: "Priya's party", content: party() });
  await publishRemote(rec.id, { slug: "priya", visibility: "unlisted", unlockAt: null, expiresAt: null });
  return rec;
}

describe("small helpers", () => {
  it("makes CSV cells safe for spreadsheets", () => {
    expect(csvCell("Raj")).toBe("Raj");
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell(3)).toBe("3");
    expect(rsvpCsv([{ name: "A", response: "yes", guests: 1, createdAt: "2026-10-10" }])).not.toContain("Email");
    expect(rsvpCsv([{ name: "A", response: "yes", guests: 1, email: "a@b.com", createdAt: "2026-10-10" }])).toContain("Name,Answer,Guests,Note,Email,Received");
    const csv = rsvpCsv([{ name: "माँ", response: "yes", guests: 2, note: "line1\nline2", createdAt: "2026-10-10" }]);
    expect(csv.startsWith("\ufeffName,Answer,Guests,Note,Received\r\n")).toBe(true);
    expect(csv).toContain('"line1\nline2"');
  });
  it("wraps story text into at most three lines", () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapLines("Happy Birthday Priya", 100, 3, measure)).toEqual(["Happy", "Birthday", "Priya"]);
    expect(wrapLines("Short", 500, 3, measure)).toEqual(["Short"]);
    const long = wrapLines("one two three four five six seven eight nine ten", 80, 2, measure);
    expect(long).toHaveLength(2);
    expect(long[1]!.endsWith("…")).toBe(true);
    expect(wrapLines("Supercalifragilistic", 50, 3, measure)).toEqual(["Supercalifragilistic"]); // one long word still shows
  });
  it("recognises invite links by their path", () => {
    expect(parseLocation("/c/priya", "", "?k=abc")).toMatchObject({ name: "contribute", params: { slug: "priya" } });
    expect(parseLocation("/c/priya", "", "?k=abc").query.get("k")).toBe("abc");
    expect(parseLocation("/", "#/inbox/pg_1").name).toBe("inbox");
  });
});

describe("voice notes in the editor", () => {
  it("only audio under the size limit is accepted", async () => {
    await expect(saveAudio(new Blob(["x"], { type: "image/png" }))).rejects.toThrow(/audio/);
    await expect(saveAudio(new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "audio/webm" }))).rejects.toThrow(/too large/);
    const ok = await saveAudio(new Blob([new Uint8Array(500)], { type: "audio/webm" }));
    expect(ok.asset).toMatch(/^ast_/);
  });
  it("offers an upload when the browser cannot record, and saves the file as a voice note", async () => {
    const seen: unknown[] = [];
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(<VoiceRecorder value={null} onChange={(v) => seen.push(v)} />));
    expect(text()).toContain("Upload an audio file"); // jsdom has no MediaRecorder
    const input = q('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [new File([new Uint8Array(400)], "note.webm", { type: "audio/webm" })] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 30)); });
    expect(seen).toHaveLength(1);
    expect((seen[0] as { asset: string }).asset).toMatch(/^ast_/);
  });
});

describe("guest messages, end to end through the real server", () => {
  it("a guest's wish waits for approval, then shows to the next visitor", async () => {
    const rec = await publishParty();
    setTokenGetter(async () => null); // a stranger opens the page
    await visit("/p/priya");
    expect(text()).toContain("Wishes for Priya");
    expect(qa(".mfy-wishes li")).toHaveLength(0);
    await type(q("form input.mfy-in") as HTMLInputElement, "Meera");
    await type(q("form textarea") as HTMLTextAreaElement, "Happy birthday Priya!");
    await act(async () => { await new Promise((r) => setTimeout(r, 1600)); }); // a real person takes longer than 1.5 s
    await submit(q("form")!);
    expect(q(".mfy-thanks")?.textContent).toContain("approved");
    await leave();

    // the owner sees it in the inbox and approves it
    setTokenGetter(async () => "dev:abhi");
    await visit(`#/inbox/${rec.id}`, "abhi");
    await settle(250);
    expect(text()).toContain("Happy birthday Priya!");
    expect(text()).toContain("Waiting for you");
    await act(async () => button("Show on the wall").click());
    await settle(100);
    expect(text()).toContain("On the wall");
    await leave();

    // the next visitor sees the wish on the wall
    setTokenGetter(async () => null);
    await visit("/p/priya");
    expect(q(".mfy-wishes")?.textContent).toContain("Happy birthday Priya!");
    expect(q(".mfy-wishes")?.textContent).toContain("Meera");
  });

  it("an invite link lets a friend add a wish without seeing the page", async () => {
    const rec = await publishParty();
    await visit(`#/inbox/${rec.id}`, "abhi");
    await settle(250);
    await act(async () => button("Get the invite link").click());
    await settle(100);
    const link = (q('input[aria-label="Invite link"]') as HTMLInputElement).value;
    expect(link).toContain("/c/priya?k=");
    await leave();

    setTokenGetter(async () => null);
    const url = new URL(link);
    await visit(`${url.pathname}${url.search}`);
    await settle(150);
    expect(text()).toContain("Wishes for Priya");
    expect(text()).toContain("For Priya");
    expect(text()).not.toContain("A secret plan."); // the page itself is never shown here
    await type(q('input[aria-label="Your name"]') as HTMLInputElement, "Rohan");
    await type(q('textarea[aria-label="Your wish"]') as HTMLTextAreaElement, "Cannot wait for the party");
    await act(async () => { await new Promise((r) => setTimeout(r, 1600)); });
    await submit(q("form")!);
    expect(text()).toContain("Thank you");
    await leave();

    setTokenGetter(async () => "dev:abhi");
    await visit(`#/inbox/${rec.id}`, "abhi");
    await settle(250);
    expect(text()).toContain("Cannot wait for the party");
    expect(text()).toContain("via invite link");
  });

  it("a switched-off invite link shows a friendly message", async () => {
    await publishParty();
    setTokenGetter(async () => null);
    await visit("/c/priya?k=garbage");
    await settle(100);
    expect(text()).toContain("This invitation is not valid");
  });

  it("the dashboard counts what is waiting", async () => {
    const rec = await publishParty();
    const { assetToken } = (await apiRaw("/p/priya")).data;
    const wall = rec.content.blocks.find((b) => b.type === "wishes")!;
    setTokenGetter(async () => null);
    await apiRaw("/p/priya/submit", { json: { token: assetToken, kind: "wish", blockId: wall.id, payload: { name: "A", message: "B" } } });
    setTokenGetter(async () => "dev:abhi");
    await visit("#/me", "abhi");
    await settle(250);
    expect(text()).toContain("1 wish to approve");
    expect(getState().pages[rec.id]!.status).toBe("published");
    expect(button("Messages")).toBeTruthy();
  });
});
