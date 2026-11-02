// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlock, isSafeLink, registry, starterSkeleton, type Content } from "@madeforyou/schema";
import { PageRenderer } from "../src";
import { buildIcs, formatEvent, safeHref, togetherSince } from "../src/util";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function page(type: string, fields: Record<string, unknown> = {}, ph?: string[]): Content {
  const b = createBlock(type);
  Object.assign(b.fields, fields);
  if (ph) b.ph = ph;
  else b.ph = b.ph.filter((n) => !(n in fields));
  return { ...starterSkeleton(), blocks: [b] };
}
async function mount(content: Content, props: { static?: boolean } = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<PageRenderer content={content} skipOpening {...props} />));
  return host;
}
const q = (s: string) => host!.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...host!.querySelectorAll<HTMLElement>(s)];
const click = (el: Element) => act(async () => (el as HTMLElement).click());

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  vi.useRealTimers();
});

describe("every block renders", () => {
  for (const type of Object.keys(registry)) {
    for (const isStatic of [false, true]) {
      it(`${type}${isStatic ? " (thumbnail)" : ""} shows its placeholders without errors`, async () => {
        await mount(page(type, {}, createBlock(type).ph), { static: isStatic });
        expect(q(`[data-block="${type}"]`)).toBeTruthy();
      });
    }
  }
});

describe("the ask", () => {
  const ask = () => page("ask", { question: "Will you?", yes: "Yes!", no: "No", celebration: "She said yes" });
  it("celebrates when they say yes", async () => {
    await mount(ask());
    await click(q(".mfy-ask-yesbtn"));
    expect(q(".mfy-ask-yes").textContent).toContain("She said yes");
    expect(qa(".mfy-burst span").length).toBeGreaterThan(5);
  });
  it("the No button runs away from a mouse, and the Yes button grows", async () => {
    await mount(ask());
    const no = q(".mfy-ask-nobtn");
    // jsdom has no PointerEvent, so build the event by hand (React turns pointerover into onPointerEnter)
    const over = new Event("pointerover", { bubbles: true });
    Object.defineProperty(over, "pointerType", { value: "mouse" });
    const before = no.style.translate;
    await act(async () => no.dispatchEvent(over));
    expect(no.style.translate).not.toBe(before);
    expect(no.style.translate).toMatch(/px/);
    expect(q(".mfy-ask-yesbtn").style.scale).not.toBe("1");
  });
  it("asks 'Are you sure?' if No is clicked", async () => {
    await mount(ask());
    await click(q(".mfy-ask-nobtn"));
    expect(q(".mfy-ask-nobtn").textContent).toBe("Are you sure?");
    await click(q(".mfy-ask-nobtn"));
    expect(q(".mfy-ask-nobtn").textContent).toBe("Really?");
  });
});

describe("the quiz", () => {
  const quiz = () => page("quiz", {
    title: "Quiz",
    questions: [
      { question: "Q1?", optionA: "right", optionB: "wrong", optionC: "", optionD: "", correct: "A" },
      { question: "Q2?", optionA: "wrong", optionB: "right", optionC: "", optionD: "", correct: "B" },
    ],
    resultHigh: "Perfect", resultMid: "Okay", resultLow: "Hmm",
  });
  it("marks answers, then shows the score and the matching message", async () => {
    await mount(quiz());
    expect(q(".mfy-quiz-q").textContent).toBe("Q1?");
    expect(qa(".mfy-quiz-opts button")).toHaveLength(2); // empty options are not shown
    await click(qa(".mfy-quiz-opts button")[0]!);
    expect(qa(".mfy-quiz-opts button")[0]!.dataset.state).toBe("right");
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(q(".mfy-quiz-q").textContent).toBe("Q2?");
    await click(qa(".mfy-quiz-opts button")[0]!); // wrong
    expect(qa(".mfy-quiz-opts button")[0]!.dataset.state).toBe("wrong");
    expect(qa(".mfy-quiz-opts button")[1]!.dataset.state).toBe("right");
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(q(".mfy-quiz-score").textContent).toContain("1 / 2");
    expect(q(".mfy-quiz-result").textContent).toBe("Okay");
  });
});

describe("reasons, open-when and reveal", () => {
  it("flips a reason card", async () => {
    await mount(page("reasons", { style: "flip", items: [{ text: "Your laugh" }] }));
    const card = q(".mfy-flip");
    expect(card.dataset.open).toBe("false");
    await click(card);
    expect(card.dataset.open).toBe("true");
    expect(card.textContent).toContain("Your laugh");
  });
  it("opens one letter at a time", async () => {
    await mount(page("openWhen", { letters: [{ label: "Open when sad", message: "Hug." }, { label: "Open when happy", message: "Dance." }] }));
    const heads = qa(".mfy-ow-head");
    await click(heads[0]!);
    expect(q(".mfy-ow-letter").textContent).toBe("Hug.");
    await click(heads[1]!);
    expect(qa(".mfy-ow-letter")).toHaveLength(1);
    expect(q(".mfy-ow-letter").textContent).toBe("Dance.");
    await click(heads[1]!);
    expect(qa(".mfy-ow-letter")).toHaveLength(0);
  });
  it("tap-to-reveal removes the cover", async () => {
    await mount(page("reveal", { message: "Surprise!", style: "tap" }));
    expect(q(".mfy-card-wrap").classList.contains("done")).toBe(false);
    await click(q("button.mfy-foil"));
    expect(q(".mfy-card-wrap").classList.contains("done")).toBe(true);
    expect(qa("button.mfy-foil")).toHaveLength(0);
  });
  it("a scratch card always has a plain button to reveal it, for people who cannot scratch", async () => {
    await mount(page("reveal", { message: "Surprise!", style: "scratch" }));
    await click(q(".mfy-textbtn"));
    expect(q(".mfy-card-wrap").classList.contains("done")).toBe(true);
  });
});

describe("video", () => {
  const vid = (provider: string, id: string) => page("video", { video: { provider, id } });
  it("loads nothing from YouTube until it is tapped, then plays with the privacy-friendly player", async () => {
    await mount(vid("youtube", "dQw4w9WgXcQ"));
    expect(qa("iframe")).toHaveLength(0);
    await click(q(".mfy-video-poster"));
    const f = q("iframe") as HTMLIFrameElement;
    expect(f.src).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(f.getAttribute("sandbox")).toContain("allow-scripts");
  });
  it("uses Vimeo's player for Vimeo ids", async () => {
    await mount(vid("vimeo", "123456789"));
    await click(q(".mfy-video-poster"));
    expect((q("iframe") as HTMLIFrameElement).src).toContain("https://player.vimeo.com/video/123456789");
  });
  it("never builds a player from a bad id, and never in a thumbnail", async () => {
    await mount(vid("youtube", "x\"><script>"));
    expect((q(".mfy-video-poster") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root!.unmount());
    host!.remove();
    await mount(vid("youtube", "dQw4w9WgXcQ"), { static: true });
    expect((q(".mfy-video-poster") as HTMLButtonElement).disabled).toBe(true);
    expect(qa("iframe")).toHaveLength(0);
  });
});

describe("links", () => {
  it("renders safe links and refuses script links", async () => {
    await mount(page("buttons", { items: [
      { label: "WhatsApp", url: "https://wa.me/919876543210" },
      { label: "Call", url: "tel:+919876543210" },
      { label: "Evil", url: "javascript:alert(1)" },
    ] }));
    const anchors = qa("a.mfy-linkbtn");
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual(["https://wa.me/919876543210", "tel:+919876543210"]);
    expect(anchors[0]!.getAttribute("rel")).toContain("noopener");
    expect(host!.innerHTML).not.toContain("javascript:");
  });
  it("agrees with the schema about what is safe", () => {
    for (const v of ["", "https://a.co", "http://a.co", "mailto:a@b.co", "tel:+9198", "javascript:alert(1)", "data:text/html,x", "//evil.com", "ftp://x.co", "not a link"]) {
      expect(safeHref(v) === v && v !== "" ? true : v === "" ? true : false).toBe(isSafeLink(v) && v !== "" ? true : v === "");
    }
  });
});

describe("event", () => {
  it("shows the date and time in India time, with add-to-calendar and a safe maps link", async () => {
    await mount(page("event", { title: "Wedding", when: "2027-02-14T18:30:00+05:30", place: "The Hall", mapsLink: "https://maps.google.com/?q=hall" }));
    expect(q(".mfy-event-list").textContent).toContain("Sunday, 14 February 2027");
    expect(q(".mfy-event-list").textContent).toMatch(/6:30\s?pm/i);
    expect(qa("button.mfy-linkbtn")[0]!.textContent).toBe("Add to calendar");
    expect(q("a.mfy-linkbtn").getAttribute("href")).toBe("https://maps.google.com/?q=hall");
  });
  it("builds a valid calendar file", () => {
    const ics = buildIcs({ title: "Wedding, Part 1", when: "2027-02-14T18:30:00+05:30", place: "Hall; Mumbai", note: "Bring\nsmiles" }, Date.parse("2026-10-07T00:00:00Z"));
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20270214T130000Z");
    expect(ics).toContain("DTEND:20270214T150000Z");
    expect(ics).toContain("SUMMARY:Wedding\\, Part 1");
    expect(ics).toContain("LOCATION:Hall\\; Mumbai");
    expect(ics).toContain("DESCRIPTION:Bring\\nsmiles");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(buildIcs({ title: "x", when: "nope" })).toBe("");
    expect(buildIcs({ title: "All day", when: "2027-02-14" })).toContain("DTSTART;VALUE=DATE:20270214");
  });
  it("formats date-only values without a time", () => {
    expect(formatEvent("2027-02-14")).toEqual({ date: "Sunday, 14 February 2027", time: "" });
    expect(formatEvent("junk")).toBeNull();
  });
});

describe("days together", () => {
  const now = Date.parse("2026-10-07T06:00:00Z"); // 11:30 IST on 7 Oct 2026
  it("counts years, months and days on the calendar", () => {
    expect(togetherSince("2023-08-02", now)).toMatchObject({ y: 3, m: 2, d: 5, future: false });
    expect(togetherSince("2026-10-07", now)).toMatchObject({ y: 0, m: 0, d: 0, days: 0 });
    expect(togetherSince("2026-09-30", now)).toMatchObject({ y: 0, m: 0, d: 7 });
    expect(togetherSince("2025-10-08", now)).toMatchObject({ y: 0, m: 11, d: 29 });
  });
  it("counts total days, and a future date as 'starts in'", () => {
    expect(togetherSince("2026-01-01", now)!.days).toBe(279);
    expect(togetherSince("2026-10-17", now)).toMatchObject({ future: true, days: 10 });
    expect(togetherSince("garbage", now)).toBeNull();
  });
  it("renders the counter after mounting", async () => {
    await mount(page("daysTogether", { label: "Together for", since: "2020-01-01" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(q(".mfy-count-3").textContent).toMatch(/years/);
    expect(q(".mfy-together-sub").textContent).toMatch(/days of us/);
  });
});

describe("memory match", () => {
  it("matches pairs, counts moves and announces the win", async () => {
    await mount(page("memory", { title: "Match", photos: [], winMessage: "You won" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    const cards = qa(".mfy-mem-card");
    expect(cards).toHaveLength(8); // four pairs of sample symbols when there are no photos yet
    const symbolOf = (c: HTMLElement) => c.querySelector(".mfy-mem-front")!.textContent;
    const groups = new Map<string, HTMLElement[]>();
    for (const c of cards) groups.set(symbolOf(c)!, [...(groups.get(symbolOf(c)!) ?? []), c]);
    // a wrong pair first
    const keys = [...groups.keys()];
    await click(groups.get(keys[0]!)![0]!);
    await click(groups.get(keys[1]!)![0]!);
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(qa(".mfy-mem-card[data-face=\"true\"]")).toHaveLength(0);
    for (const k of keys) {
      const [a, b] = groups.get(k)!;
      await click(a!); await click(b!);
      await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    }
    expect(q(".mfy-mem-win").textContent).toBe("You won");
    expect(q(".mfy-mem-moves").textContent).toContain("5 moves");
  });
});

import type { Host } from "../src";

describe("guest messages on the page", () => {
  const cleanup: (() => Promise<void>)[] = [];
  const mountWith = async (content: Content, host?: Host) => {
    const el = document.createElement("div");
    document.body.append(el);
    const r = createRoot(el);
    await act(async () => r.render(<PageRenderer content={content} skipOpening host={host} />));
    cleanup.push(async () => { await act(async () => r.unmount()); el.remove(); });
    return el;
  };
  afterEach(async () => { for (const c of cleanup.splice(0)) await c(); });
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const submitForm = (el: HTMLElement) => act(async () => { el.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });

  it("a preview (no host) shows sample wishes and a disabled form, never a working one", async () => {
    const el = await mountWith(page("wishes", { title: "Wishes", prompt: "Say hi" }));
    expect(el.querySelectorAll(".mfy-wishes li")).toHaveLength(2);
    expect((el.querySelector("button[type=submit]") as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector(".mfy-form-note")!.textContent).toContain("once the page is live");
  });
  it("sends a wish with the hidden field and the time taken, then thanks the guest", async () => {
    const calls: unknown[][] = [];
    const host: Host = { submit: async (...a) => { calls.push(a); return { ok: true, status: "pending" }; }, wishes: {} };
    const content = page("wishes", { title: "Wishes", prompt: "Say hi" });
    const el = await mountWith(content, host);
    await type(el.querySelector("input.mfy-in") as HTMLInputElement, "Meera");
    await type(el.querySelector("textarea") as HTMLTextAreaElement, "Happy birthday");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await submitForm(el);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe(content.blocks[0]!.id);
    expect(calls[0]![1]).toBe("wish");
    expect(calls[0]![2]).toEqual({ name: "Meera", message: "Happy birthday" });
    expect(calls[0]![3]).toMatchObject({ website: "" });
    expect((calls[0]![3] as { elapsedMs: number }).elapsedMs).toBeGreaterThanOrEqual(1500);
    expect(el.querySelector(".mfy-thanks")!.textContent).toContain("approved");
  });
  it("shows approved wishes from the host, and the server's error message when sending fails", async () => {
    const content = page("wishes", { title: "Wishes" });
    const id = content.blocks[0]!.id;
    const host: Host = { submit: async () => ({ ok: false, error: "Please take a moment before sending" }), wishes: { [id]: [{ id: "w1", name: "Raj", message: "Cheers!" }] } };
    const el = await mountWith(content, host);
    expect(el.querySelector(".mfy-wishes")!.textContent).toContain("Cheers!");
    expect(el.querySelector(".mfy-wishes")!.classList.contains("mfy-ph")).toBe(false);
    await type(el.querySelector("input.mfy-in") as HTMLInputElement, "A");
    await type(el.querySelector("textarea") as HTMLTextAreaElement, "B");
    await submitForm(el);
    expect(el.querySelector(".mfy-form-error")!.textContent).toContain("take a moment");
  });
  it("RSVP: a 'yes' sends the guest count", async () => {
    const calls: Record<string, unknown>[] = [];
    const host: Host = { submit: async (_b, _k, payload) => { calls.push(payload); return { ok: true }; } };
    const el = await mountWith(page("rsvp", { title: "Coming?", thanksYes: "See you!", thanksNo: "We will miss you" }), host);
    await type(el.querySelector("input.mfy-in") as HTMLInputElement, "Raj");
    expect(el.querySelector("select")).toBeNull(); // no answer yet
    await click(el.querySelectorAll(".mfy-choice button")[0]!);
    expect(el.querySelector("select")).toBeTruthy();
    await act(async () => { const s = el.querySelector("select")!; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(s, "3"); s.dispatchEvent(new Event("change", { bubbles: true })); });
    await submitForm(el);
    expect(calls[0]).toMatchObject({ name: "Raj", response: "yes", guests: 3 });
    expect(el.querySelector(".mfy-thanks")!.textContent).toBe("See you!");
  });
  it("RSVP 'no' says the 'no' thanks and brings no guests", async () => {
    const calls: Record<string, unknown>[] = [];
    const host: Host = { submit: async (_b, _k, payload) => { calls.push(payload); return { ok: true }; } };
    const el = await mountWith(page("rsvp", { title: "Coming?", thanksYes: "See you!", thanksNo: "We will miss you" }), host);
    await type(el.querySelector("input.mfy-in") as HTMLInputElement, "Sneha");
    await click(el.querySelectorAll(".mfy-choice button")[1]!);
    expect(el.querySelector("select")).toBeNull();
    await submitForm(el);
    expect(calls[0]).toMatchObject({ response: "no", guests: 0 });
    expect(el.querySelector(".mfy-thanks")!.textContent).toBe("We will miss you");
  });
  it("a reply box sends the message and says the owner's thank-you", async () => {
    const calls: Record<string, unknown>[] = [];
    const host: Host = { submit: async (_b, _k, payload) => { calls.push(payload); return { ok: true }; } };
    const el = await mountWith(page("replyBox", { title: "Write back", prompt: "Say it", thanks: "I read every word" }), host);
    await type(el.querySelector("textarea") as HTMLTextAreaElement, "I cried");
    await submitForm(el);
    expect(calls[0]).toMatchObject({ message: "I cried" });
    expect(el.querySelector(".mfy-thanks")!.textContent).toBe("I read every word");
  });
  it("nothing is sent from a thumbnail", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    const r = createRoot(el);
    await act(async () => r.render(<PageRenderer content={page("rsvp", { title: "Coming?" })} skipOpening static host={{ submit: async () => ({ ok: true }) }} />));
    expect(el.querySelector("form")).toBeNull();
    await act(async () => r.unmount());
    el.remove();
  });
});

describe("voice note and map", () => {
  it("plays the voice note from the asset the host resolves, and shows its length", async () => {
    const c = page("voiceNote", { title: "For you", audio: { asset: "ast_voice01", seconds: 42 } });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(<PageRenderer content={c} skipOpening resolveAsset={(r) => `https://cdn.example/${r.asset}.webm`} />));
    expect((q("audio") as HTMLAudioElement).src).toBe("https://cdn.example/ast_voice01.webm");
    expect(q(".mfy-time").textContent).toBe("0:42");
    expect((q(".mfy-player .mfy-play") as HTMLButtonElement).disabled).toBe(false);
  });
  it("without a recording the player is a disabled sample", async () => {
    await mount(page("voiceNote", {}, ["audio", "title"]));
    expect((q(".mfy-player .mfy-play") as HTMLButtonElement).disabled).toBe(true);
    expect(qa("audio")).toHaveLength(0);
  });
  it("the map loads only when tapped, centred on the place, with links that are safe", async () => {
    await mount(page("map", { title: "Where", location: { lat: 19.076, lng: 72.8777 } }));
    expect(qa("iframe")).toHaveLength(0);
    await click(q(".mfy-map-poster"));
    const f = q("iframe") as HTMLIFrameElement;
    expect(f.src).toContain("https://www.openstreetmap.org/export/embed.html?bbox=72.8717,19.072,72.8837,19.08");
    expect(f.src).toContain("marker=19.076,72.8777");
    expect(q("a.mfy-linkbtn").getAttribute("href")).toBe("https://www.google.com/maps?q=19.076,72.8777");
  });
  it("never builds a map from bad coordinates, or in a thumbnail", async () => {
    await mount(page("map", { title: "Where", location: { lat: 999, lng: 0 } }));
    expect((q(".mfy-map-poster") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root!.unmount());
    host!.remove();
    await mount(page("map", { title: "Where", location: { lat: 19, lng: 72 } }), { static: true });
    expect((q(".mfy-map-poster") as HTMLButtonElement).disabled).toBe(true);
  });
});
