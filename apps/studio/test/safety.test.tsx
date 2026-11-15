import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@madeforyou/api";
import { makeEnv } from "@madeforyou/api/testing";
import { createBlock, setField, starterSkeleton, type Content } from "@madeforyou/schema";
import { App } from "../src/App";
import { apiRaw, setTokenGetter } from "../src/lib/api";
import { AuthProvider } from "../src/lib/auth";
import { LEGAL_UPDATED, PRIVACY, TERMS } from "../src/lib/legal";
import { upiUri } from "../src/lib/support";
import { supportUpi } from "../src/lib/config";
import { authRetry, publishRemote } from "../src/lib/sync";
import { createPage, getState, resetStore } from "../src/state/store";

function party(): Content {
  let c = starterSkeleton();
  const [hero, text, , sig] = c.blocks;
  c = setField(c, hero!.id, "recipient", "Priya");
  c = setField(c, hero!.id, "title", "Happy Birthday Priya");
  c = setField(c, text!.id, "body", "A secret plan.");
  c = setField(c, sig!.id, "name", "Abhi");
  c = { ...c, blocks: c.blocks.filter((b) => b.type !== "gallery") };
  const wall = createBlock("wishes");
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
  sessionStorage.clear();
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
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

/** Waits until something is true (up to 6 s) instead of guessing how long a slow computer needs. */
async function until(cond: () => boolean | Promise<boolean>, ms = 6000) {
  const end = Date.now() + ms;
  while (!(await cond()) && Date.now() < end) await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
}
const settle = (ms = 120) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function visit(url: string, user?: string) {
  if (user) localStorage.setItem("mfy:dev-user", user);
  else localStorage.removeItem("mfy:dev-user");
  if (url.startsWith("#")) { window.history.pushState({}, "", "/"); window.location.hash = url; }
  else window.history.pushState({}, "", url);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<AuthProvider><App /></AuthProvider>));
  await settle(80);
}
const text = () => host!.textContent ?? "";
const q = (s: string) => host!.querySelector<HTMLElement>(s);
const qa = (s: string) => [...host!.querySelectorAll<HTMLElement>(s)];
const button = (label: string | RegExp) => [...document.body.querySelectorAll<HTMLElement>("button, a")].find((b) => (typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? "")))!;
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit(form: Element) {
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 120)); });
}
async function publishParty() {
  const rec = createPage({ title: "Priya's party", content: party() });
  await publishRemote(rec.id, { slug: "priya", visibility: "unlisted", unlockAt: null, expiresAt: null });
  return rec;
}
const row = async (sql: string) => (await env.DB.prepare(sql).first()) as any;

describe("Terms and Privacy", () => {
  it("name who runs the service and how to reach them, and are not left half-written", () => {
    for (const doc of [TERMS, PRIVACY]) {
      const all = JSON.stringify(doc);
      expect(all).toContain("Abhishek Wagh");
      expect(all).toContain("wabhi2009@gmail.com");
      expect(doc.updated).toBe(LEGAL_UPDATED);
      expect(doc.summary.length).toBeGreaterThan(40);
      expect(doc.sections.length).toBeGreaterThanOrEqual(9);
      expect(all).not.toMatch(/TODO|lorem|xxx/i);
    }
    // what the privacy page promises matches what the server does
    expect(JSON.stringify(PRIVACY)).toContain("30 days");
    expect(JSON.stringify(PRIVACY)).toMatch(/Brevo/);
    expect(JSON.stringify(PRIVACY)).toMatch(/Clerk/);
  });

  it("are pages of their own, reachable from the footer on every screen", async () => {
    await visit("#/templates");
    const links = qa(".footer-links a").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual(expect.arrayContaining([["Terms", "#/terms"], ["Privacy", "#/privacy"], ["Contact", "mailto:wabhi2009@gmail.com"], ["Account", "#/account"]]));
    await act(async () => { window.location.hash = "#/terms"; });
    await settle(60);
    expect(q("h1")?.textContent).toBe("Terms of use");
    expect(text()).toContain("Abhishek Wagh");
    await act(async () => { window.location.hash = "#/privacy"; });
    await settle(60);
    expect(q("h1")?.textContent).toBe("Privacy");
    expect(text()).toContain("wabhi2009@gmail.com");
  });

  it("are agreed to when publishing", async () => {
    const rec = createPage({ title: "x", content: party() });
    await visit(`#/publish/${rec.id}`, "abhi");
    expect(text()).toContain("By publishing you agree to the Terms");
  });
});

describe("Report this page", () => {
  it("a visitor can report, and the owner of the page does not see the link on their own page", async () => {
    await publishParty();
    setTokenGetter(async () => null);
    await visit("/p/priya");
    expect(button("Report this page")).toBeTruthy();
    await act(async () => button("Report this page").click());
    expect(document.body.textContent).toContain("What is wrong with this page?");
    const send = button("Send report") as HTMLButtonElement;
    expect(send.disabled).toBe(true); // a reason must be chosen first
    await act(async () => (document.body.querySelector('input[name="reason"][value="spam"]') as HTMLInputElement).click());
    await type(document.body.querySelector(".report textarea") as HTMLTextAreaElement, "Sells things");
    await act(async () => (button("Send report") as HTMLButtonElement).click());
    await until(() => document.body.textContent!.includes("Thank you. We have your report"));
    expect(document.body.textContent).toContain("Thank you. We have your report");
    expect(await row("SELECT reason, details, slug, status FROM reports")).toEqual({ reason: "spam", details: "Sells things", slug: "priya", status: "open" });

    await act(async () => root!.unmount());
    host!.remove();
    setTokenGetter(async () => "dev:abhi");
    await visit("/p/priya", "abhi");
    expect(button("Report this page")).toBeUndefined();
  });
});

describe("Delete my account and all my data", () => {
  it("asks for DELETE, then removes everything on the server and on this device", async () => {
    await publishParty();
    await visit("#/account", "abhi");
    expect(text()).toContain("Delete my account and all my data");
    await act(async () => button("Delete my account").click());
    const confirmBtn = () => button("Delete everything") as HTMLButtonElement;
    expect(confirmBtn().disabled).toBe(true);
    const input = document.body.querySelector('input[aria-label="Type DELETE to confirm"]') as HTMLInputElement;
    await type(input, "nope");
    expect(confirmBtn().disabled).toBe(true);
    expect((await row("SELECT COUNT(*) AS n FROM pages")).n).toBe(1); // nothing happened yet

    await type(input, "delete");
    expect(confirmBtn().disabled).toBe(false);
    await submit(document.body.querySelector(".sheet form")!);
    await until(async () => (await row("SELECT COUNT(*) AS n FROM pages")).n === 0 && window.location.hash === "#/");

    expect((await row("SELECT COUNT(*) AS n FROM pages")).n).toBe(0);
    expect((await row("SELECT COUNT(*) AS n FROM users")).n).toBe(0);
    expect(Object.keys(getState().pages)).toHaveLength(0);
    expect(localStorage.getItem("mfy:dev-user")).toBeNull(); // signed out
    expect(window.location.hash).toBe("#/");
    expect((await apiRaw("/p/priya", { auth: false })).status).toBe(404);
  });

  it("without an account it only clears what is on this device", async () => {
    vi.stubEnv("VITE_REMOTE", "");
    createPage({ title: "Local", content: party() });
    await visit("#/account");
    expect(text()).toContain("Clear everything on this device");
    expect(text()).toContain("1 page on this device");
    await act(async () => button("Clear this device").click());
    await act(async () => (button("Clear everything") as HTMLButtonElement).click());
    await settle(200);
    expect(Object.keys(getState().pages)).toHaveLength(0);
  });
});

describe("the site owner's review page", () => {
  it("lists a report and takes the page down", async () => {
    await publishParty();
    await apiRaw("/p/priya/report", { json: { reason: "abuse", details: "Rude to me", contact: "a@b.com" }, auth: false });
    vi.stubGlobal("confirm", () => true);
    await visit("#/admin");
    expect(text()).toContain("Admin token");
    await type(q('input[aria-label="Admin token"]') as HTMLInputElement, "wrong");
    await submit(q("form")!);
    await settle(150);
    expect(text()).toContain("not accepted");

    await type(q('input[aria-label="Admin token"]') as HTMLInputElement, "admin-token-123");
    await submit(q("form")!);
    await settle(200);
    expect(text()).toContain("Priya's party");
    expect(text()).toContain("Rude to me");
    expect(text()).toContain("a@b.com");

    await act(async () => button("Take the page down").click());
    await until(async () => (await row("SELECT status FROM pages")).status === "draft");
    await settle(150);
    expect((await row("SELECT status, taken_down_at FROM pages")).status).toBe("draft");
    expect((await apiRaw("/p/priya", { auth: false })).status).toBe(404);
    expect(text()).toContain("Nothing waiting");
  });
});

describe("Support us", () => {
  it("builds a UPI link that apps understand", () => {
    expect(upiUri("abhi@okbank")).toBe("upi://pay?pa=abhi@okbank&pn=Abhishek%20Wagh&cu=INR&tn=MadeForYou%20support");
    expect(upiUri("abhi@okbank", 50)).toContain("&am=50.00");
    expect(upiUri("abhi@okbank", 0)).not.toContain("am=");
  });

  it("is hidden until a valid UPI ID is set", async () => {
    for (const bad of ["", "   ", "not a upi id", "a@b", "x@y z", "<script>@evil"]) {
      vi.stubEnv("VITE_SUPPORT_UPI", bad);
      expect(supportUpi()).toBe("");
    }
    // an ID made of a mobile number would publish that number, so it is never shown
    for (const phone of ["9876543210@ybl", "919876543210@ybl", "+919876543210@okbank"]) {
      vi.stubEnv("VITE_SUPPORT_UPI", phone);
      expect(supportUpi()).toBe("");
    }
    vi.stubEnv("VITE_SUPPORT_UPI", " abhi.wagh-1@okhdfcbank ");
    expect(supportUpi()).toBe("abhi.wagh-1@okhdfcbank");

    vi.stubEnv("VITE_SUPPORT_UPI", "");
    await visit("#/templates");
    expect(qa(".footer-links a").map((a) => a.textContent)).not.toContain("Support us");
    await act(async () => { window.location.hash = "#/support"; });
    await settle(60);
    expect(text()).toContain("not switched on yet");
  });

  it("shows the footer link and a page with a QR code, the ID and one-tap amounts", async () => {
    vi.stubEnv("VITE_SUPPORT_UPI", "abhi@okbank");
    await visit("#/templates");
    const link = qa(".footer-links a").find((a) => a.textContent === "Support us");
    expect(link?.getAttribute("href")).toBe("#/support");

    await act(async () => { window.location.hash = "#/support"; });
    await settle(150);
    expect(q("h1")?.textContent).toContain("helped you, you can say thanks");
    expect(text()).toContain("completely fine"); // it never pressures anyone
    expect(text()).toContain("abhi@okbank");
    expect(q(".support-qr img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    const pay = () => button("Pay with a UPI app") as HTMLAnchorElement;
    expect(pay().getAttribute("href")).toBe("upi://pay?pa=abhi@okbank&pn=Abhishek%20Wagh&cu=INR&tn=MadeForYou%20support");

    await act(async () => button("\u20b950").click());
    await settle(100);
    expect(pay().getAttribute("href")).toContain("am=50.00");
    expect(button("\u20b950").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Any amount").click());
    expect(pay().getAttribute("href")).not.toContain("am=");
  });

  it("is mentioned, quietly, once a page has been shared", async () => {
    vi.stubEnv("VITE_SUPPORT_UPI", "abhi@okbank");
    const rec = await publishParty();
    await visit(`#/share/${rec.id}`, "abhi");
    await settle(200);
    expect(text()).toContain("Did MadeForYou help you today?");
    expect(q(".support-nudge a")?.getAttribute("href")).toBe("#/support");
  });

  it("is explained in the Terms and the Privacy page", () => {
    expect(JSON.stringify(TERMS)).toContain("voluntary gift");
    expect(JSON.stringify(PRIVACY)).toContain("Support payments");
    expect(JSON.stringify(PRIVACY)).toContain("never see your bank details");
  });
});

describe("Signing in stays on our site", () => {
  it("has its own /sign-in and /sign-up pages, whatever Clerk puts after the #", async () => {
    const { parseLocation } = await import("../src/lib/router");
    expect(parseLocation("/sign-in", "").name).toBe("signin");
    expect(parseLocation("/sign-in/", "#/sso-callback").name).toBe("signin");
    expect(parseLocation("/sign-up", "#/continue").name).toBe("signup");
    expect(parseLocation("/", "#/me").name).toBe("me"); // the studio's own routes are untouched
  });
  it("points Clerk at those pages, never at Clerk's hosted ones", async () => {
    const { CLERK_ROUTES } = await import("../src/lib/config");
    expect(CLERK_ROUTES).toEqual({ signInUrl: "/sign-in", signUpUrl: "/sign-up", after: "/" });
  });
  it("shows a clear message where sign-in is not set up", async () => {
    await visit("/sign-in");
    expect(text()).toContain("Signing in is not switched on here");
  });
});
