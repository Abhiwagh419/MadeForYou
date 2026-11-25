import { turnstileSiteKey } from "./config";

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widget: string): void;
  remove(widget: string): void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

export const HUMAN_CHECK_FAILED = "We could not confirm you are a person. Please try again.";

let script: Promise<TurnstileApi> | null = null;
function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    el.async = true;
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not start")));
    el.onerror = () => { script = null; reject(new Error("Turnstile could not be loaded")); };
    document.head.append(el);
  });
  return script;
}

function box(): HTMLElement {
  let el = document.getElementById("mfy-turnstile");
  if (!el) {
    el = document.createElement("div");
    el.id = "mfy-turnstile";
    el.setAttribute("style", "display:none;position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%);z-index:1000;padding:12px;background:#fff;border:1px solid #F3DCCB;border-radius:14px;box-shadow:0 10px 30px rgba(74,14,31,.25)");
    document.body.append(el);
  }
  return el;
}

export async function humanToken(timeoutMs = 25_000): Promise<string | undefined> {
  const sitekey = turnstileSiteKey();
  if (!sitekey) return undefined;
  const api = await loadScript();
  const holder = box();
  return new Promise<string>((resolve, reject) => {
    let widget = "";
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      holder.style.display = "none";
      try { if (widget) api.remove(widget); } catch { }
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("timeout"))), timeoutMs);
    widget = api.render(holder, {
      sitekey,
      execution: "execute",
      appearance: "interaction-only",
      callback: (token: string) => finish(() => resolve(token)),
      "error-callback": () => finish(() => reject(new Error("error"))),
      "expired-callback": () => finish(() => reject(new Error("expired"))),
      "before-interactive-callback": () => { holder.style.display = "block"; },
      "after-interactive-callback": () => { holder.style.display = "none"; },
    });
    api.execute(widget);
  });
}

export async function checkHuman(): Promise<{ ok: true; token?: string } | { ok: false; error: string }> {
  try {
    return { ok: true, token: await humanToken() };
  } catch {
    return { ok: false, error: HUMAN_CHECK_FAILED };
  }
}
