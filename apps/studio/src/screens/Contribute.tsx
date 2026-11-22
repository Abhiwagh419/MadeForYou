import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRAND, themeToCssVars } from "@madeforyou/ui";
import { apiRaw } from "../lib/api";
import { useRoute } from "../lib/router";
import { checkHuman } from "../lib/turnstile";
import { Button } from "../ui/Button";
import { Mark } from "../ui/Logo";

interface Info { blockId: string; heading: string; prompt: string; recipient: string; theme: string }

/** What a friend sees from an invite link: a single box to leave a wish, never the page itself. */
export function Contribute() {
  const route = useRoute();
  const { slug = "" } = route.params;
  const k = route.query.get("k") ?? "";
  const [info, setInfo] = useState<Info | "loading" | "invalid" | "ended">("loading");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const started = useRef(Date.now());

  useEffect(() => {
    apiRaw<Info>(`/c/${slug}?k=${encodeURIComponent(k)}`, { auth: false })
      .then((r) => setInfo(r.status === 200 ? r.data : r.status === 410 ? "ended" : "invalid"))
      .catch(() => setInfo("invalid"));
  }, [slug, k]);

  const theme = typeof info === "object" ? info.theme : "rose-garden";
  const style = themeToCssVars(theme) as CSSProperties;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const human = await checkHuman();
      if (!human.ok) { setError(human.error); setState("idle"); return; }
      const r = await apiRaw(`/c/${slug}/submit?k=${encodeURIComponent(k)}`, { auth: false, json: { payload: { name, message }, website, elapsedMs: Date.now() - started.current, ...(human.token ? { turnstile: human.token } : {}) } });
      if (r.status === 200) { setStatus(r.data.status); setState("done"); return; }
      setError(r.data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("We could not reach the server. Please try again.");
    }
    setState("idle");
  };

  return (
    <main className="gate" style={style}>
      <div className="gate-card">
        {info === "loading" ? <p>Opening…</p>
          : info === "invalid" ? (<><h1>This invitation is not valid</h1><p>The link may have been switched off. Ask the person who sent it for a new one.</p></>)
          : info === "ended" ? (<><h1>This page has ended</h1><p>It is not taking wishes any more.</p></>)
          : state === "done" ? (<><h1>Thank you</h1><p>{status === "approved" ? "Your wish is on the wall." : "Your wish has been sent. It will appear once it has been approved."}</p></>)
          : (
            <>
              <p className="gate-eyebrow">{info.recipient ? `For ${info.recipient}` : "A wish for someone you love"}</p>
              <h1>{info.heading || "Leave a wish"}</h1>
              <p>{info.prompt || "Write a few kind words."}</p>
              <form className="contrib-form" onSubmit={send}>
                <input className="in in-lg" value={name} maxLength={60} placeholder="Your name" aria-label="Your name" onChange={(e) => setName(e.target.value)} />
                <textarea className="in in-lg" rows={4} value={message} maxLength={500} placeholder="Your wish" aria-label="Your wish" onChange={(e) => setMessage(e.target.value)} />
                <div className="mfy-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
                {error && <p className="field-error">{error}</p>}
                <Button type="submit" size="lg" disabled={state === "sending" || !name.trim() || !message.trim()}>{state === "sending" ? "Sending…" : "Send my wish"}</Button>
              </form>
            </>
          )}
      </div>
      <p className="gate-foot"><Mark size={18} />{BRAND.badgeText}</p>
    </main>
  );
}
