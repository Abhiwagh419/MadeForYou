import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@madeforyou/api";
import { makeEnv } from "@madeforyou/api/testing";
import { guidedQuestions, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { App } from "../src/App";
import { apiRaw, setTokenGetter } from "../src/lib/api";
import { AuthProvider } from "../src/lib/auth";
import { mergeServerPages, publishRemote, pullPages, pushPage, toLocalPage, type ServerPage } from "../src/lib/sync";
import { createPage, getState, resetStore, savePage } from "../src/state/store";
import * as assets from "../src/lib/assets";

const SECRET_TEXT = "A secret message only Priya should read.";

function filled(): Content {
  let c = starterSkeleton();
  const [hero, text, gallery, sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", SECRET_TEXT);
  c = setField(c, gallery!.id, "items", [{ image: { asset: "ast_demo1", alt: "x" }, caption: "z" }]);
  return setField(c, sig!.id, "name", "Abhi");
}

let env: ReturnType<typeof makeEnv>;
let wire: string[]; // every response body the browser ever received
let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  vi.stubEnv("VITE_REMOTE", "1");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
  env = makeEnv();
  wire = [];
  const app = createApp();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await app.request(typeof input === "string" ? input : (input as Request).url, init, env);
    wire.push(await res.clone().text());
    return res;
  }) as typeof fetch;
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

async function visit(url: string, signedInAs?: string) {
  if (signedInAs) localStorage.setItem("mfy:dev-user", signedInAs);
  if (url.startsWith("#")) window.location.hash = url;
  else window.history.pushState({}, "", url);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<AuthProvider><App /></AuthProvider>));
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
}
const text = () => host!.textContent ?? "";
const q = (s: string) => host!.querySelector<HTMLElement>(s);
const button = (label: string) => [...host!.querySelectorAll<HTMLElement>("button, a")].find((b) => b.textContent?.trim() === label)!;
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function serverSidePublish(body: object = {}) {
  const rec = createPage({ title: "For Priya", content: filled() });
  await publishRemote(rec.id, { slug: "priya", visibility: "unlisted", unlockAt: null, expiresAt: null, ...body });
  return rec;
}

describe("merging server pages", () => {
  const base = (updatedAt: string): ServerPage => ({
    id: "pg_aaaaaa", title: "T", content: starterSkeleton(), slug: "", status: "draft", createdAt: updatedAt, updatedAt,
    access: { visibility: "unlisted", hasPassword: true, unlockAt: null, expiresAt: null },
  });
  it("takes pages it does not have, and newer ones, but never overwrites newer local work", () => {
    const local = { pg_aaaaaa: { ...toLocalPage(base("2026-10-01T00:00:00Z")), title: "mine" } };
    expect(mergeServerPages(local, [base("2026-10-02T00:00:00Z")])).toHaveLength(1);
    expect(mergeServerPages(local, [base("2026-09-30T00:00:00Z")])).toHaveLength(0);
    expect(mergeServerPages({}, [base("2026-10-02T00:00:00Z")])).toHaveLength(1);
  });
  it("marks a password as set without ever holding it", () => {
    expect(toLocalPage(base("2026-10-02T00:00:00Z")).access.passwordHash).toBe("server");
  });
});

describe("browser and server together", () => {
  it("publishes through the real API and updates the local record", async () => {
    const rec = await serverSidePublish({ password: "zq7-secret" });
    const mine = getState().pages[rec.id]!;
    expect(mine.status).toBe("published");
    expect(mine.slug).toBe("priya");
    expect(mine.access.passwordHash).toBe("server");
    expect(JSON.stringify(mine)).not.toContain("zq7-secret");
  });

  it("uploads photos that exist only on this device", async () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
    const ref = await assets.saveImage(new File([webp], "a.webp", { type: "image/webp" }));
    const rec = createPage({ title: "Photo page", content: filled() });
    const withPhoto = setField(rec.content, rec.content.blocks[2]!.id, "items", [{ image: { asset: ref.asset }, caption: "us" }]);
    savePage(rec.id, { content: withPhoto });
    await pushPage(getState().pages[rec.id]!);
    expect(env.FILES.keys()).toContain(`a/${ref.asset}`);
  });

  it("opens an open page for a visitor on the real path /p/slug", async () => {
    await serverSidePublish();
    setTokenGetter(async () => null); // a stranger
    await visit("/p/priya");
    expect(q(".mfy-page")).toBeTruthy();
    expect(text()).toContain(SECRET_TEXT);
  });

  it("a locked page: the visitor sees a countdown and the secret never crosses the wire", async () => {
    await serverSidePublish({ unlockAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
    setTokenGetter(async () => null);
    wire = [];
    await visit("/p/priya");
    expect(text()).toContain("Not just yet");
    expect(q(".mfy-page")).toBeNull();
    const everything = wire.join("\n");
    for (const s of [SECRET_TEXT, "Happy Birthday Priya", "ast_demo1", "Abhi"]) expect(everything).not.toContain(s);
  });

  it("a password page: wrong password is refused, the right one opens it", async () => {
    await serverSidePublish({ password: "zq7-secret" });
    setTokenGetter(async () => null);
    wire = [];
    await visit("/p/priya");
    expect(text()).toContain("Enter the password");
    expect(wire.join("\n")).not.toContain(SECRET_TEXT);
    const submit = async (pw: string) => {
      await type(q('input[aria-label="Password"]') as HTMLInputElement, pw);
      await act(async () => { q("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 40)); });
    };
    await submit("nope-nope");
    expect(text()).toContain("not the password");
    expect(wire.join("\n")).not.toContain(SECRET_TEXT);
    await submit("zq7-secret");
    expect(q(".mfy-page")).toBeTruthy();
  });

  it("an unknown link shows a friendly page", async () => {
    setTokenGetter(async () => null);
    await visit("/p/does-not-exist");
    expect(text()).toContain("This page is not here");
  });

  it("publish screen asks a signed-out visitor to sign in first", async () => {
    const rec = createPage({ title: "For Priya", content: filled() });
    await visit(`#/publish/${rec.id}`);
    expect(text()).toContain("Create your free account");
    expect((button("Publish") as HTMLButtonElement).disabled).toBe(true);
  });

  it("signed in, the publish screen checks the link with the server and publishes", async () => {
    const other = createPage({ title: "Other", content: filled() });
    await publishRemote(other.id, { slug: "priya", visibility: "unlisted", unlockAt: null, expiresAt: null });
    resetStore(); // a different browser: it knows nothing locally
    const rec = createPage({ title: "Mine", content: filled() });
    await visit(`#/publish/${rec.id}`, "abhi");
    // abhi owns "priya" already, so the same person republishing is fine; try as someone else:
    setTokenGetter(async () => "dev:sam");
    localStorage.setItem("mfy:dev-user", "sam");
    await act(async () => root!.unmount());
    host!.remove();
    await visit(`#/publish/${rec.id}`, "sam");
    expect(text()).toContain("Someone already has this link");
    expect((button("Publish") as HTMLButtonElement).disabled).toBe(true);
    await type(q('input[aria-label="Page link"]') as HTMLInputElement, "priya-for-sam");
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    expect(text()).toContain("This link is available");
    await act(async () => button("Publish").click());
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(window.location.hash).toBe(`#/share/${rec.id}`);
    expect(getState().pages[rec.id]!.status).toBe("published");
  });

  it("signing in on a new device brings your pages over", async () => {
    const rec = await serverSidePublish();
    resetStore(); // new device
    expect(Object.keys(getState().pages)).toHaveLength(0);
    await visit("#/me", "abhi");
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(getState().pages[rec.id]?.title).toBe("For Priya");
    expect(text()).toContain("For Priya");
    expect(await pullPages()).toBe(0); // nothing newer to bring
  });

  it("reports server problems in plain words", async () => {
    const rec = createPage({ title: "Unfinished", content: starterSkeleton() });
    await expect(publishRemote(rec.id, { slug: "unfinished", visibility: "unlisted", unlockAt: null, expiresAt: null })).rejects.toThrow(/filling in/);
    const raw = await apiRaw("/me/pages", { auth: false });
    expect(raw.status).toBe(401);
    expect(guidedQuestions(rec.content).length).toBeGreaterThan(0);
  });

  it("when the server refuses a sign-in, says why on screen instead of a bare 'please sign in'", async () => {
    env.ALLOW_DEV_AUTH = "0"; // the server no longer accepts the browser's login
    const rec = createPage({ title: "For Priya", content: filled() });
    await visit("#/me", "abhi");
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(q(".auth-banner")?.textContent).toContain("did not accept your login");
    expect(q(".auth-banner")?.textContent).toMatch(/no sign-in settings|did not send|token/);

    await act(async () => root!.unmount());
    host!.remove();
    await visit(`#/publish/${rec.id}`, "abhi");
    await act(async () => button("Publish").click());
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(text()).toContain("did not accept your sign-in");
  });
});
