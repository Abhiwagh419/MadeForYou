import { useRef, useState, type CSSProperties, type FormEvent, type ReactElement } from "react";
import type { AudioRef, Block, Geo } from "@madeforyou/schema";
import { useFields, useRender } from "./context";
import { label } from "./labels";

type P = { block: Block };
const idx = (i: number) => ({ "--i": i }) as CSSProperties;

/** A hidden field real people never see; bots fill it. The server drops anything that does. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mfy-hp" aria-hidden="true">
      <label>Website<input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} /></label>
    </div>
  );
}

type Kind = "wish" | "reply" | "rsvp";

/** Shared sending logic for the three kinds of guest message. */
function useSender(blockId: string, kind: Kind) {
  const { host, lang } = useRender();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [website, setWebsite] = useState("");
  const started = useRef(Date.now());
  const live = !!host?.submit;
  const send = async (payload: Record<string, unknown>) => {
    if (!host?.submit) return false;
    setState("sending");
    setError("");
    try {
      const r = await host.submit(blockId, kind, payload, { website, elapsedMs: Date.now() - started.current });
      if (r.ok) { setState("done"); setStatus(r.status ?? ""); return true; }
      setError(r.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("We could not reach the server. Please try again.");
    }
    setState("idle");
    return false;
  };
  return { live, state, error, status, website, setWebsite, send, lang };
}

/* ---------------- Wishes wall ---------------- */
export function Wishes({ block }: P) {
  const x = useFields(block);
  const s = useSender(block.id, "wish");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const real = x.host?.wishes?.[block.id] ?? [];
  const sample = real.length === 0 && !s.live;
  const shown = sample
    ? [{ id: "s1", name: "Meera", message: "Happy birthday! You deserve every good thing." }, { id: "s2", name: "Rohan", message: "Cannot wait to celebrate with you." }]
    : real;
  const submit = (e: FormEvent) => { e.preventDefault(); void s.send({ name, message }); };
  return (
    <div className="mfy-wall">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      {shown.length > 0 && (
        <ul className={`mfy-wishes ${sample ? "mfy-ph" : ""}`}>
          {shown.map((w, i) => <li key={w.id} style={idx(i)} className="mfy-rs-item"><p>{w.message}</p><b>{w.name}</b></li>)}
        </ul>
      )}
      {!x.isStatic && (
        s.state === "done" ? (
          <p className="mfy-thanks" role="status">{s.status === "approved" ? label(s.lang, "wishDone") : label(s.lang, "wishPending")}</p>
        ) : (
          <form className="mfy-form" onSubmit={submit}>
            <p className={`mfy-form-prompt ${x.ph("prompt")}`}>{x.t("prompt")}</p>
            <input className="mfy-in" value={name} maxLength={60} placeholder={label(s.lang, "yourName")} aria-label={label(s.lang, "yourName")} onChange={(e) => setName(e.target.value)} disabled={!s.live} />
            <textarea className="mfy-in" value={message} maxLength={500} rows={3} placeholder={label(s.lang, "yourWish")} aria-label={label(s.lang, "yourWish")} onChange={(e) => setMessage(e.target.value)} disabled={!s.live} />
            <Honeypot value={s.website} onChange={s.setWebsite} />
            {s.error && <p className="mfy-form-error" role="alert">{s.error}</p>}
            <button type="submit" className="mfy-linkbtn" disabled={!s.live || s.state === "sending" || !name.trim() || !message.trim()}>{s.state === "sending" ? label(s.lang, "sending") : label(s.lang, "send")}</button>
            {!s.live && <p className="mfy-form-note">{label(s.lang, "livePreview")}</p>}
          </form>
        )
      )}
    </div>
  );
}

/* ---------------- Reply box ---------------- */
export function ReplyBox({ block }: P) {
  const x = useFields(block);
  const s = useSender(block.id, "reply");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="mfy-reply">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      {!x.isStatic && (s.state === "done" ? (
        <p className={`mfy-thanks ${x.ph("thanks")}`} role="status">{x.t("thanks") || label(s.lang, "replyDone")}</p>
      ) : (
        <form className="mfy-form" onSubmit={(e) => { e.preventDefault(); void s.send({ name, message }); }}>
          <textarea className="mfy-in" value={message} maxLength={1000} rows={4} placeholder={x.t("prompt")} aria-label={x.t("title")} onChange={(e) => setMessage(e.target.value)} disabled={!s.live} />
          <input className="mfy-in" value={name} maxLength={60} placeholder={`${label(s.lang, "yourName")} (optional)`} aria-label={label(s.lang, "yourName")} onChange={(e) => setName(e.target.value)} disabled={!s.live} />
          <Honeypot value={s.website} onChange={s.setWebsite} />
          {s.error && <p className="mfy-form-error" role="alert">{s.error}</p>}
          <button type="submit" className="mfy-linkbtn" disabled={!s.live || s.state === "sending" || !message.trim()}>{s.state === "sending" ? label(s.lang, "sending") : label(s.lang, "send")}</button>
          {!s.live && <p className="mfy-form-note">{label(s.lang, "livePreview")}</p>}
        </form>
      ))}
    </div>
  );
}

/* ---------------- RSVP ---------------- */
export function Rsvp({ block }: P) {
  const x = useFields(block);
  const s = useSender(block.id, "rsvp");
  const [name, setName] = useState("");
  const [response, setResponse] = useState<"yes" | "no" | "maybe" | "">("");
  const [guests, setGuests] = useState(1);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const askGuests = x.str("guests", "yes") === "yes" && response !== "no" && response !== "";
  const ok = s.live && name.trim() && response;
  return (
    <div className="mfy-rsvp">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      {x.t("deadline") && <p className={`mfy-rsvp-deadline ${x.ph("deadline")}`}>{x.t("deadline")}</p>}
      {!x.isStatic && (s.state === "done" ? (
        <p className="mfy-thanks" role="status">{response === "no" ? x.t("thanksNo") : x.t("thanksYes")}</p>
      ) : (
        <form className="mfy-form" onSubmit={(e) => { e.preventDefault(); void s.send({ name, response, guests: askGuests ? guests : response === "no" ? 0 : 1, note, ...(x.host?.canRemind && response !== "no" && email.trim() ? { email: email.trim() } : {}) }); }}>
          <input className="mfy-in" value={name} maxLength={60} placeholder={label(s.lang, "yourName")} aria-label={label(s.lang, "yourName")} onChange={(e) => setName(e.target.value)} disabled={!s.live} />
          <div className="mfy-choice" role="radiogroup" aria-label={x.t("title")}>
            {(["yes", "no", "maybe"] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={response === r} className={response === r ? "on" : ""} disabled={!s.live} onClick={() => setResponse(r)}>{label(s.lang, r)}</button>
            ))}
          </div>
          {askGuests && (
            <label className="mfy-guests">{label(s.lang, "guests")}
              <select className="mfy-in" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </label>
          )}
          <input className="mfy-in" value={note} maxLength={200} placeholder={label(s.lang, "yourNote")} aria-label={label(s.lang, "yourNote")} onChange={(e) => setNote(e.target.value)} disabled={!s.live} />
          {x.host?.canRemind && response !== "no" && response !== "" && (
            <>
              <input className="mfy-in" type="email" inputMode="email" autoComplete="email" value={email} maxLength={254} placeholder={label(s.lang, "remindMe")} aria-label={label(s.lang, "remindMe")} onChange={(e) => setEmail(e.target.value)} />
              <p className="mfy-form-note">{label(s.lang, "remindHint")}</p>
            </>
          )}
          <Honeypot value={s.website} onChange={s.setWebsite} />
          {s.error && <p className="mfy-form-error" role="alert">{s.error}</p>}
          <button type="submit" className="mfy-linkbtn" disabled={!ok || s.state === "sending"}>{s.state === "sending" ? label(s.lang, "sending") : label(s.lang, "send")}</button>
          {!s.live && <p className="mfy-form-note">{label(s.lang, "livePreview")}</p>}
        </form>
      ))}
    </div>
  );
}

/* ---------------- Voice note ---------------- */
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

export function VoiceNote({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const ref = x.raw("audio") as AudioRef | null;
  const url = ref ? x.url(ref) : undefined;
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState(ref?.seconds ?? 0);
  const toggle = () => {
    const a = audio.current;
    if (!a || !url) return;
    if (a.paused) { void a.play?.(); } else a.pause?.();
  };
  return (
    <figure className="mfy-voice">
      {x.t("title") && <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>}
      <div className={`mfy-player ${url ? "" : "mfy-ph"}`}>
        <button type="button" className="mfy-play" onClick={toggle} disabled={!url || x.isStatic} aria-label={playing ? label(lang, "pauseNote") : label(lang, "playNote")}>
          {playing
            ? <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            : <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>}
        </button>
        <div className="mfy-wave" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ height: `${28 + ((i * 37) % 62)}%`, opacity: len && (pos / len) * 28 > i ? 1 : 0.35 }} />)}
        </div>
        <span className="mfy-time">{mmss(playing || pos ? pos : len)}</span>
        {url && !x.isStatic && (
          <audio ref={audio} src={url} preload="none"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPos(0); }}
            onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLen(e.currentTarget.duration)} />
        )}
      </div>
      {x.t("caption") && <figcaption className={x.ph("caption")}>{x.t("caption")}</figcaption>}
    </figure>
  );
}

/* ---------------- Place on a map ---------------- */
export function MapBlock({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const [loaded, setLoaded] = useState(false);
  const g = x.raw("location") as Geo | null;
  const ok = !!g && Number.isFinite(g.lat) && Number.isFinite(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180;
  const src = ok ? `https://www.openstreetmap.org/export/embed.html?bbox=${g.lng - 0.006},${g.lat - 0.004},${g.lng + 0.006},${g.lat + 0.004}&layer=mapnik&marker=${g.lat},${g.lng}` : "";
  const gmaps = ok ? `https://www.google.com/maps?q=${g.lat},${g.lng}` : "";
  return (
    <figure className="mfy-map">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <div className={`mfy-map-box ${ok ? "" : "mfy-ph"}`}>
        {loaded && ok && !x.isStatic ? (
          <iframe title={x.t("title") || "Map"} src={src} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
        ) : (
          <button type="button" className="mfy-map-poster" disabled={!ok || x.isStatic} onClick={() => setLoaded(true)}>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="currentColor" d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zm0-8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" /></svg>
            <span>{label(lang, "loadMap")}</span>
          </button>
        )}
      </div>
      {x.t("note") && <figcaption className={x.ph("note")}>{x.t("note")}</figcaption>}
      {ok && !x.isStatic && <a className="mfy-linkbtn mfy-linkbtn-2" href={gmaps} target="_blank" rel="noopener noreferrer">{label(lang, "openMaps")}</a>}
    </figure>
  );
}

export const SOCIAL: Record<string, (p: P) => ReactElement> = { wishes: Wishes, replyBox: ReplyBox, rsvp: Rsvp, voiceNote: VoiceNote, map: MapBlock };
