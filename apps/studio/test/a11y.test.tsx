import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "../src/ui/Controls";
import { ErrorBoundary } from "../src/ui/ErrorBoundary";

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  vi.restoreAllMocks();
});
async function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
}
const press = (key: string, shiftKey = false) => act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })); });

describe("a screen that crashes", () => {
  const Bomb = () => { throw new Error("boom"); };

  it("shows a calm message with a way out, not a blank page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await mount(<div><p>header stays</p><ErrorBoundary><Bomb /></ErrorBoundary></div>);
    expect(host!.querySelector("[role=alert]")?.textContent).toContain("Something went wrong");
    expect(host!.querySelector("a[href='/#/']")).toBeTruthy();
    expect(host!.querySelector("button")?.textContent).toBe("Reload the page");
    expect(host!.textContent).toContain("header stays");
  });
  it("leaves a healthy screen alone", async () => {
    await mount(<ErrorBoundary><p>all good</p></ErrorBoundary>);
    expect(host!.textContent).toBe("all good");
  });
});

describe("a popup (Sheet)", () => {
  function Demo() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button id="opener" onClick={() => setOpen(true)}>Open</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Example">
          <button id="first">First</button>
          <input id="middle" aria-label="Middle" />
          <button id="last">Last</button>
        </Sheet>
      </div>
    );
  }
  const $ = (s: string) => document.querySelector<HTMLElement>(s)!;

  it("is announced as a dialog and takes the keyboard focus", async () => {
    await mount(<Demo />);
    $("#opener").focus();
    await act(async () => $("#opener").click());
    const dialog = $("[role=dialog]");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Example");
    expect(document.activeElement).toBe(dialog);
  });
  it("keeps Tab inside, both ways round", async () => {
    await mount(<Demo />);
    await act(async () => $("#opener").click());
    const firstStop = $("[role=dialog]").querySelector("button")!;
    $("#last").focus();
    await press("Tab");
    expect(document.activeElement).toBe(firstStop);
    await press("Tab", true);
    expect(document.activeElement).toBe($("#last"));
  });
  it("closes with Escape and gives the focus back to the button that opened it", async () => {
    await mount(<Demo />);
    $("#opener").focus();
    await act(async () => $("#opener").click());
    await press("Escape");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.activeElement).toBe($("#opener"));
  });
});
