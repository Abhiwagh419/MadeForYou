import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { guidedQuestions, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { getTemplate } from "@madeforyou/templates";
import { App } from "../src/App";
import { sha256 } from "../src/lib/util";
import { createPage, getState, resetStore, savePage } from "../src/state/store";

let root: Root | null = null;
let host: HTMLElement | null = null;

async function visit(hash: string) {
  window.location.hash = hash;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<App />));
  return host;
}
const text = () => host!.textContent ?? "";
const q = (sel: string) => host!.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...host!.querySelectorAll<HTMLElement>(sel)];
const button = (label: string | RegExp) =>
  qa("button, a").find((b) => (typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? "")))!;
async function click(el: HTMLElement) {
  await act(async () => el.click());
}
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function filled(c: Content): Content {
  let next = c;
  for (const gq of guidedQuestions(c)) {
    const kind = gq.kind;
    const v = kind === "text" || kind === "longtext" ? "Priya" : kind === "date" ? "2027-02-14" : kind === "image" ? { asset: "ast_demo1", alt: "x" } : [{ image: { asset: "ast_demo2", alt: "y" }, caption: "z" }];
    next = setField(next, gq.blockId, gq.field, v);
  }
  return next;
}

beforeEach(() => {
  resetStore();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
});

describe("screens render and work", () => {
  it("home: headline, search and template cards", async () => {
    await visit("#/");
    expect(text()).toContain("made just for them.");
    expect(q('input[aria-label="Search templates"]')).toBeTruthy();
    expect(qa(".tcard").length).toBeGreaterThanOrEqual(6);
  });

  it("search finds Mother's Day from 'maa' and from a typo", async () => {
    await visit("#/templates?q=maa");
    expect(text()).toContain("A letter for Maa");
    await act(async () => root!.unmount());
    host!.remove();
    await visit("#/templates?q=birthdya");
    expect(text()).toContain("Birthday surprise");
  });

  it("an unknown search offers to create the first one", async () => {
    await visit("#/templates?q=xyzzyq");
    expect(text()).toContain("No template for “xyzzyq” yet");
    expect(button("Create the first one")).toBeTruthy();
    await click(button("Create the first one"));
    expect(Object.keys(getState().pages)).toHaveLength(1);
    expect(window.location.hash).toMatch(/^#\/make\//);
  });

  it("template preview: use it, then guided mode asks for the name first", async () => {
    await visit("#/t/mothers-day-letter");
    expect(text()).toContain("A letter for Maa");
    await click(button("Use this template"));
    expect(Object.keys(getState().pages)).toHaveLength(1);
    expect(window.location.hash).toMatch(/^#\/make\//);
    await act(async () => root!.unmount());
    host!.remove();
    await visit(window.location.hash);
    expect(text()).toContain("Who is this made for?");
    const next = button("Next") as HTMLButtonElement;
    expect(next.disabled).toBe(true); // required
    await type(q('input[aria-label="Recipient"]') as HTMLInputElement, "Priya");
    expect((button("Next") as HTMLButtonElement).disabled).toBe(false);
    const page = Object.values(getState().pages)[0]!;
    expect(page.content.blocks[0]!.fields.recipient).toBe("Priya");
    expect(page.content.blocks[0]!.ph).not.toContain("recipient");
    await click(button("Next"));
    expect(text()).toContain("Write your letter");
  });

  it("editor: lists blocks, edits a field, adds a block, undoes", async () => {
    const p = createPage({ title: "Test", content: starterSkeleton() });
    await visit(`#/edit/${p.id}`);
    expect(text()).toContain("Hero / Cover");
    expect(text()).toContain("Photo gallery");
    await click(button("Add a block"));
    expect(text()).toContain("Add a block");
    await click(qa(".addcard").find((c) => c.textContent?.includes("Countdown"))!);
    expect(text()).toContain("Countdown");
    expect(qa(".blocklist li")).toHaveLength(5);
    await click(q('button[aria-label="Undo"]')!);
    expect(qa(".blocklist li")).toHaveLength(4);
  });

  it("editor: design tab changes the theme", async () => {
    const p = createPage({ title: "Test", content: starterSkeleton() });
    await visit(`#/edit/${p.id}`);
    await click(qa(".panel-tabs button").find((b) => b.textContent?.includes("Design"))!);
    await click(qa(".theme").find((b) => b.textContent?.includes("Marigold"))!);
    expect(q(".mfy-page")?.getAttribute("data-theme")).toBe("marigold-sun");
  });

  it("publish: blocks an unfinished page, allows a finished one, then shows the share screen", async () => {
    const p = createPage({ title: "For Priya", content: starterSkeleton() });
    await visit(`#/publish/${p.id}`);
    expect(text()).toContain("Quick check");
    expect((button("Publish") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root!.unmount());
    host!.remove();

    savePage(p.id, { content: filled(p.content) });
    await visit(`#/publish/${p.id}`);
    const slugInput = q('input[aria-label="Page link"]') as HTMLInputElement;
    expect(slugInput.value).toBe("priya");
    expect(text()).toContain("This link is available");
    await click(button("Publish"));
    await act(async () => { await Promise.resolve(); });
    expect(getState().pages[p.id]!.status).toBe("published");
    expect(window.location.hash).toBe(`#/share/${p.id}`);
  });

  it("a taken link is refused", async () => {
    const a = createPage({ title: "A", content: filled(starterSkeleton()) });
    savePage(a.id, { slug: "priya", status: "published" });
    const b = createPage({ title: "B", content: filled(starterSkeleton()) });
    await visit(`#/publish/${b.id}`);
    expect(text()).toContain("Someone already has this link");
    expect((button("Publish") as HTMLButtonElement).disabled).toBe(true);
  });

  it("share screen has the link, WhatsApp and a QR code", async () => {
    const p = createPage({ title: "For Priya", content: filled(starterSkeleton()) });
    savePage(p.id, { slug: "priya", status: "published" });
    await visit(`#/share/${p.id}`);
    expect(text()).toContain("It is live");
    expect((q('input[aria-label="Page link"]') as HTMLInputElement).value).toContain("#/p/priya");
    expect(button("Send on WhatsApp").getAttribute("href")).toContain("https://wa.me/?text=");
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(q('img[alt^="QR code"]')?.getAttribute("src")).toMatch(/^data:image\/png/);
  });

  it("dashboard lists pages and shows the empty state", async () => {
    await visit("#/me");
    expect(text()).toContain("Nothing here yet");
    await act(async () => root!.unmount());
    host!.remove();
    createPage({ title: "My first page", content: starterSkeleton() });
    await visit("#/me");
    expect(text()).toContain("My first page");
    expect(text()).toContain("Draft");
  });

  it("share as template: personal content is listed, removed by default, and the template is saved", async () => {
    const p = createPage({ title: "For Priya", content: filled(starterSkeleton()) });
    savePage(p.id, { slug: "priya", status: "published" });
    await visit(`#/template-from/${p.id}`);
    expect(text()).toContain("What stays private");
    expect(qa(".strip-list li").length).toBeGreaterThan(5);
    expect((button("Create template") as HTMLButtonElement).disabled).toBe(true); // no title yet
    const title = q('input[placeholder^="A birthday surprise"]') as HTMLInputElement;
    await type(title, "A letter for Priya"); // a name from the page: refused
    expect(text()).toContain("a name from your page");
    expect((button("Create template") as HTMLButtonElement).disabled).toBe(true);
    await type(title, "A warm thank-you page");
    await click(button("Create template"));
    const made = Object.values(getState().templates);
    expect(made).toHaveLength(1);
    expect(JSON.stringify(made[0]!.template)).not.toContain("Priya");
    expect(JSON.stringify(made[0]!.template)).not.toContain("ast_demo");
  });

  it("visitor page: open, password, locked, ended and missing", async () => {
    const base = filled(getTemplate("thank-you-simple")!.content);
    const open = createPage({ title: "Open", content: base });
    savePage(open.id, { slug: "open-one", status: "published" });
    await visit("#/p/open-one");
    expect(q(".mfy-page")).toBeTruthy();
    await act(async () => root!.unmount()); host!.remove();

    const locked = createPage({ title: "Locked", content: base });
    savePage(locked.id, { slug: "locked-one", status: "published", access: { visibility: "unlisted", unlockAt: new Date(Date.now() + 86400000 * 3).toISOString() } });
    await visit("#/p/locked-one");
    expect(text()).toContain("Not just yet");
    expect(q(".mfy-page")).toBeNull(); // locked content is never rendered early
    await act(async () => root!.unmount()); host!.remove();

    const pw = createPage({ title: "Secret", content: base });
    savePage(pw.id, { slug: "secret-one", status: "published", access: { visibility: "unlisted", passwordHash: await sha256("rose") } });
    await visit("#/p/secret-one");
    expect(text()).toContain("Enter the password");
    expect(q(".mfy-page")).toBeNull();
    await type(q('input[aria-label="Password"]') as HTMLInputElement, "wrong");
    await act(async () => { q("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 20)); });
    expect(text()).toContain("That is not it");
    await type(q('input[aria-label="Password"]') as HTMLInputElement, "rose");
    await act(async () => { q("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 20)); });
    expect(q(".mfy-page")).toBeTruthy();
    await act(async () => root!.unmount()); host!.remove();

    const ended = createPage({ title: "Ended", content: base });
    savePage(ended.id, { slug: "ended-one", status: "published", access: { visibility: "unlisted", expiresAt: new Date(Date.now() - 1000).toISOString() } });
    await visit("#/p/ended-one");
    expect(text()).toContain("This page has ended");
    await act(async () => root!.unmount()); host!.remove();

    await visit("#/p/nope-nope");
    expect(text()).toContain("This page is not here");
  });

  it("unknown routes and ids show a friendly page", async () => {
    await visit("#/edit/pg_missing");
    expect(text()).toContain("We could not find that page");
  });
});
