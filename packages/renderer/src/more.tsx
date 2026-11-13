import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import type { AssetRef, Block } from "@madeforyou/schema";
import { useFields, useRender } from "./context";
import { label } from "./labels";
import { buildIcs, formatEvent, parseTarget, safeHref, shape, togetherSince } from "./util";

type P = { block: Block };
const idx = (i: number) => ({ "--i": i }) as CSSProperties;
const items = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function Heart({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1.1 4.2 2.4h3.6C14.6 6.1 16 5 18 5c3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

/* ---------------- Featured photo ---------------- */
export function Featured({ block }: P) {
  const x = useFields(block);
  const url = x.url(x.raw("image"));
  const ref = x.ref(x.raw("image"));
  const caption = x.t("caption");
  return (
    <figure className={`mfy-featured mfy-fr-${x.str("frame", "polaroid")}`}>
      <div className="mfy-feat-img">{url ? <img src={url} alt={ref?.alt ?? caption} loading="lazy" decoding="async" style={shape(ref)} /> : <span className={`mfy-tile-fill ${x.ph("image")}`} />}</div>
      {caption && <figcaption className={x.ph("caption")}>{caption}</figcaption>}
    </figure>
  );
}

/* ---------------- Timeline ---------------- */
export function Timeline({ block }: P) {
  const x = useFields(block);
  const list = items(x.raw("items"));
  return (
    <div className="mfy-timeline-wrap">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <ol className={`mfy-timeline ${x.ph("items")}`}>
        {list.map((it, i) => {
          const url = x.url(it.image);
          return (
            <li key={i} className="mfy-tl-item" style={idx(i)}>
              <span className="mfy-tl-dot" aria-hidden="true" />
              {str(it.date) && <p className="mfy-tl-date">{str(it.date)}</p>}
              {str(it.title) && <h3>{str(it.title)}</h3>}
              {url && <img src={url} alt={(it.image as AssetRef).alt ?? str(it.title)} loading="lazy" decoding="async" style={shape(it.image as AssetRef)} />}
              {str(it.text) && <p className="mfy-tl-text">{str(it.text)}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- Days together ---------------- */
function useMinute(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DaysTogether({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const now = useMinute();
  const t = now === null ? null : togetherSince(x.str("since"), now);
  const days = t ? t.days.toLocaleString("en-IN") : "–";
  const showYmd = x.str("show", "ymd") === "ymd";
  const cell = (v: number | string, key: string) => (
    <div key={key}><dd>{v}</dd><dt>{label(lang, key)}</dt></div>
  );
  return (
    <div className="mfy-together">
      <p className={`mfy-together-label ${x.ph("label")}`}>{x.t("label")}</p>
      {!x.str("since") ? (
        <p className="mfy-ph mfy-count-empty">{label(lang, "pickDate")}</p>
      ) : t && t.future ? (
        <p className="mfy-count-done">{label(lang, "startsIn")} {t.days.toLocaleString("en-IN")} {label(lang, "days")}</p>
      ) : (
        <>
          {showYmd ? (
            <dl className={`mfy-count mfy-count-3 ${x.ph("since")}`}>
              {cell(t?.y ?? "–", "years")}
              {cell(t?.m ?? "–", "months")}
              {cell(t?.d ?? "–", "days")}
            </dl>
          ) : (
            <p className={`mfy-together-days ${x.ph("since")}`}>{days}</p>
          )}
          {showYmd && <p className="mfy-together-sub">{days} {label(lang, "daysOfUs")}</p>}
        </>
      )}
    </div>
  );
}

/* ---------------- Video (a poster first, the player only when asked) ---------------- */
export function Video({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const [playing, setPlaying] = useState(false);
  const raw = x.raw("video") as { provider?: string; id?: string } | null;
  const ok = raw && (raw.provider === "youtube" || raw.provider === "vimeo") && /^[A-Za-z0-9_-]{6,20}$/.test(raw.id ?? "");
  const src = !ok ? "" : raw!.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${raw!.id}?autoplay=1&rel=0&playsinline=1`
    : `https://player.vimeo.com/video/${raw!.id}?autoplay=1`;
  const poster = ok && raw!.provider === "youtube" ? `https://i.ytimg.com/vi/${raw!.id}/hqdefault.jpg` : "";
  return (
    <figure className="mfy-video">
      {x.t("title") && <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>}
      <div className={`mfy-video-box ${ok ? "" : "mfy-ph"}`}>
        {playing && ok && !x.isStatic ? (
          <iframe title={x.t("title") || "Video"} src={src} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <button type="button" className="mfy-video-poster" disabled={!ok || x.isStatic} onClick={() => setPlaying(true)} aria-label={label(lang, "play")}
            style={poster && !x.isStatic ? { backgroundImage: `url(${poster})` } : undefined}>
            <span className="mfy-play"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg></span>
          </button>
        )}
      </div>
      {x.t("caption") && <figcaption className={x.ph("caption")}>{x.t("caption")}</figcaption>}
    </figure>
  );
}

/* ---------------- Quote / shayari ---------------- */
export function Quote({ block }: P) {
  const x = useFields(block);
  const lines = x.t("text").split("\n");
  return (
    <blockquote className={`mfy-quote mfy-quote-${x.str("style", "shayari")}`}>
      <p className={x.ph("text")}>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>)}</p>
      {x.t("author") && <footer className={x.ph("author")}>{x.t("author")}</footer>}
    </blockquote>
  );
}

/* ---------------- Reasons ---------------- */
export function Reasons({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const list = items(x.raw("items"));
  const flip = x.str("style", "cards") === "flip";
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <div className="mfy-reasons-wrap">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <ol className={`mfy-reasons ${flip ? "mfy-reasons-flip" : ""} ${x.ph("items")}`}>
        {list.map((it, i) => flip ? (
          <li key={i} style={idx(i)} className="mfy-rs-item">
            <button type="button" className="mfy-flip" data-open={open.has(i)} aria-pressed={open.has(i)} onClick={() => toggle(i)}>
              <span className="mfy-flip-face mfy-flip-front"><b>{i + 1}</b><small>{label(lang, "tapToFlip")}</small></span>
              <span className="mfy-flip-face mfy-flip-back">{str(it.text)}</span>
            </button>
          </li>
        ) : (
          <li key={i} style={idx(i)} className="mfy-rs-item mfy-rs-card"><b aria-hidden="true">{i + 1}</b><span>{str(it.text)}</span></li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- Checklist ---------------- */
export function Checklist({ block }: P) {
  const x = useFields(block);
  const list = items(x.raw("items"));
  const promises = x.str("style", "promises") === "promises";
  return (
    <div className="mfy-checklist-wrap">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <ul className={`mfy-checklist ${x.ph("items")}`}>
        {list.map((it, i) => (
          <li key={i} style={idx(i)} className="mfy-rs-item">
            <span className={`mfy-tick ${promises ? "on" : ""}`} aria-hidden="true">
              {promises ? <Heart size={14} /> : null}
            </span>
            <span>{str(it.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Open when ---------------- */
export function OpenWhen({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const list = items(x.raw("letters"));
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mfy-ow-wrap">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <ul className={`mfy-ow ${x.ph("letters")}`}>
        {list.map((it, i) => (
          <li key={i} style={idx(i)} className="mfy-rs-item" data-open={open === i}>
            <button type="button" className="mfy-ow-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="mfy-ow-seal" aria-hidden="true"><Heart size={16} /></span>
              <span className="mfy-ow-label">{str(it.label)}</span>
              <small>{open === i ? label(lang, "close") : label(lang, "openIt")}</small>
            </button>
            {open === i && <div className="mfy-ow-letter"><p>{str(it.message)}</p></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Scratch card ---------------- */
export function Reveal({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const tap = x.str("style", "scratch") === "tap";
  const [done, setDone] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hint = x.str("hint", label(lang, "reveal"));

  useEffect(() => {
    const c = canvas.current;
    if (!c || tap || x.isStatic || done) return;
    const ctx = c.getContext?.("2d");
    if (!ctx) return;
    const w = c.clientWidth, h = c.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#cfc8bf"); g.addColorStop(0.45, "#f3eee8"); g.addColorStop(1, "#bdb4aa");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#7d7268";
    ctx.font = '600 16px "Poppins", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(hint, w / 2, h / 2 + 5);
    let down = false;
    const at = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(e.clientX - r.left, e.clientY - r.top, 24, 0, Math.PI * 2);
      ctx.fill();
    };
    const cleared = () => {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0, total = 0;
      for (let i = 3; i < d.length; i += 64) { total++; if (d[i] === 0) n++; }
      return n / total;
    };
    const downH = (e: PointerEvent) => { down = true; c.setPointerCapture?.(e.pointerId); at(e); };
    const moveH = (e: PointerEvent) => { if (down) at(e); };
    const upH = () => { if (down) { down = false; if (cleared() > 0.5) setDone(true); } };
    c.addEventListener("pointerdown", downH); c.addEventListener("pointermove", moveH);
    c.addEventListener("pointerup", upH); c.addEventListener("pointercancel", upH);
    return () => {
      c.removeEventListener("pointerdown", downH); c.removeEventListener("pointermove", moveH);
      c.removeEventListener("pointerup", upH); c.removeEventListener("pointercancel", upH);
    };
  }, [tap, x.isStatic, done, hint]);

  return (
    <div className="mfy-reveal">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <div className={`mfy-card-wrap ${done ? "done" : ""}`}>
        <p className={`mfy-card-msg ${x.ph("message")}`}>{x.t("message")}</p>
        {tap ? (
          !done && <button type="button" className="mfy-foil" onClick={() => setDone(true)}>{x.str("hint", label(lang, "tapReveal"))}</button>
        ) : (
          <>
            {!done && <canvas ref={canvas} className="mfy-foil mfy-foil-canvas" aria-hidden="true" />}
            {x.isStatic && !done && <span className="mfy-foil mfy-foil-static">{hint}</span>}
          </>
        )}
      </div>
      {!tap && !done && !x.isStatic && <button type="button" className="mfy-textbtn" onClick={() => setDone(true)}>{label(lang, "reveal")}</button>}
    </div>
  );
}

/* ---------------- The Ask ---------------- */
export function Ask({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const [yes, setYes] = useState(false);
  const [dodges, setDodges] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [noClicks, setNoClicks] = useState(0);
  const reduce = reducedMotion();
  const noText = noClicks === 0 ? x.str("no", "No") : noClicks === 1 ? label(lang, "sure") : label(lang, "reallySure");

  const dodge = (e: { preventDefault: () => void }) => {
    if (reduce || dodges >= 6 || x.isStatic) return false;
    e.preventDefault();
    setDodges((d) => d + 1);
    setPos({ x: (Math.random() - 0.5) * 150, y: (Math.random() - 0.5) * 90 });
    return true;
  };

  return (
    <div className="mfy-ask">
      <h2 className={`mfy-ask-q ${x.ph("question")}`}>{x.t("question")}</h2>
      {yes ? (
        <div className="mfy-ask-yes" role="status">
          <div className="mfy-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ "--i": i } as CSSProperties}><Heart size={18} /></span>)}</div>
          <p className={x.ph("celebration")}>{x.t("celebration")}</p>
        </div>
      ) : (
        <div className="mfy-ask-btns">
          <button type="button" className="mfy-ask-yesbtn" disabled={x.isStatic} style={{ scale: String(1 + Math.min(dodges + noClicks, 6) * 0.12) }} onClick={() => setYes(true)}>
            {x.str("yes", "Yes!")}
          </button>
          <button
            type="button" className="mfy-ask-nobtn" disabled={x.isStatic}
            style={{ translate: `${pos.x}px ${pos.y}px` }}
            onPointerEnter={(e) => e.pointerType === "mouse" && dodge(e)}
            onPointerDown={(e) => e.pointerType !== "mouse" && dodge(e)}
            onClick={() => setNoClicks((n) => n + 1)}
          >{noText}</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Quiz ---------------- */
const LETTERS = ["A", "B", "C", "D"] as const;

export function Quiz({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const qs = items(x.raw("questions")).filter((q) => str(q.question));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const finished = i >= qs.length && qs.length > 0;
  const q = qs[i];

  const pick = (l: string) => {
    if (picked || !q || x.isStatic) return;
    setPicked(l);
    if (l === q.correct) setScore((s) => s + 1);
    setTimeout(() => { setPicked(null); setI((n) => n + 1); }, reducedMotion() ? 700 : 1100);
  };
  const ratio = qs.length ? score / qs.length : 0;
  const result = ratio >= 0.8 ? x.t("resultHigh") : ratio >= 0.5 ? x.t("resultMid") : x.t("resultLow");

  return (
    <div className="mfy-quiz">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <div className={`mfy-quiz-card ${x.ph("questions")}`}>
        {finished ? (
          <div className="mfy-quiz-end">
            <p className="mfy-quiz-score">{label(lang, "score")} <b>{score} / {qs.length}</b></p>
            <p className="mfy-quiz-result">{result}</p>
            <button type="button" className="mfy-textbtn" onClick={() => { setI(0); setScore(0); setPicked(null); }}>{label(lang, "again")}</button>
          </div>
        ) : q ? (
          <>
            <p className="mfy-quiz-step">{i + 1} / {qs.length}</p>
            <p className="mfy-quiz-q">{str(q.question)}</p>
            <div className="mfy-quiz-opts">
              {LETTERS.map((l) => str(q[`option${l}`]) ? (
                <button key={l} type="button" disabled={x.isStatic} data-state={picked ? (l === q.correct ? "right" : l === picked ? "wrong" : "idle") : "idle"} onClick={() => pick(l)}>
                  <b>{l}</b><span>{str(q[`option${l}`])}</span>
                </button>
              ) : null)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Memory match ---------------- */
const SYMBOLS = ["♥", "✿", "★", "☾", "❀", "✦", "☀", "❖"];

interface Tile { key: number; pair: number; url?: string; symbol: string }

export function Memory({ block }: P) {
  const x = useFields(block);
  const photos = items(x.raw("photos")).map((p) => p.image as AssetRef | null).filter(Boolean) as AssetRef[];
  const urls = photos.map((p) => x.url(p)).filter(Boolean) as string[];
  const pairs = urls.length >= 2 ? Math.min(urls.length, 8) : 4;
  const [deck, setDeck] = useState<Tile[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const lock = useRef(false);
  const { lang } = useRender();
  const key = urls.join("|");

  const build = useMemo(() => () => {
    const base: Tile[] = Array.from({ length: pairs }, (_, p) => ({ key: 0, pair: p, url: urls[p], symbol: SYMBOLS[p % SYMBOLS.length]! }));
    const all = [...base, ...base].map((t, k) => ({ ...t, key: k }));
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j]!, all[i]!]; }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, key]);

  useEffect(() => { setDeck(build()); setOpen([]); setMatched(new Set()); setMoves(0); }, [build]);

  const flip = (k: number) => {
    if (lock.current || x.isStatic || open.includes(k) || matched.has(deck[k]!.pair)) return;
    const next = [...open, k];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      lock.current = true;
      const [a, b] = next.map((n) => deck[n]!);
      setTimeout(() => {
        if (a!.pair === b!.pair) setMatched((s) => new Set(s).add(a!.pair));
        setOpen([]);
        lock.current = false;
      }, 750);
    }
  };
  const won = deck.length > 0 && matched.size === pairs;
  const shownDeck = deck.length ? deck : Array.from({ length: pairs * 2 }, (_, k) => ({ key: k, pair: k % pairs, url: undefined, symbol: SYMBOLS[k % pairs]! }));

  return (
    <div className="mfy-memory">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <div className={`mfy-mem-grid ${urls.length < 2 ? "mfy-ph" : ""}`}>
        {shownDeck.map((t, k) => {
          const face = open.includes(k) || matched.has(t.pair);
          return (
            <button key={t.key} type="button" className="mfy-mem-card" data-face={face} data-matched={matched.has(t.pair)} disabled={x.isStatic} onClick={() => flip(k)} aria-label={face ? `card ${t.pair + 1}` : "hidden card"}>
              <span className="mfy-mem-back"><Heart size={20} /></span>
              <span className="mfy-mem-front">{t.url ? <img src={t.url} alt="" decoding="async" /> : <i>{t.symbol}</i>}</span>
            </button>
          );
        })}
      </div>
      <p className="mfy-mem-moves">{moves} {label(lang, "moves")}</p>
      {won && <p className={`mfy-mem-win ${x.ph("winMessage")}`} role="status">{x.t("winMessage")}</p>}
    </div>
  );
}

/* ---------------- Event ---------------- */
export function Event({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const when = x.str("when");
  const f = when ? formatEvent(when) : null;
  const maps = safeHref(x.str("mapsLink"));
  const calendar = () => {
    const ics = buildIcs({ title: x.t("title"), when, place: x.t("place"), note: x.t("note") });
    if (!ics) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "event.ics";
    document.body.append(a);
    a.click();
    a.remove();
  };
  return (
    <div className="mfy-event">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      <dl className="mfy-event-list">
        <div className={x.ph("when")}><dt>When</dt><dd>{f ? <>{f.date}{f.time && <><br />{f.time}</>}</> : label(lang, "pickDate")}</dd></div>
        {x.t("place") && <div className={x.ph("place")}><dt>Where</dt><dd>{x.t("place")}</dd></div>}
        {x.t("note") && <div className={x.ph("note")}><dt>Note</dt><dd>{x.t("note")}</dd></div>}
      </dl>
      <div className="mfy-event-actions">
        {f && !x.isStatic && <button type="button" className="mfy-linkbtn" onClick={calendar}>{label(lang, "addToCalendar")}</button>}
        {maps && <a className="mfy-linkbtn mfy-linkbtn-2" href={maps} target="_blank" rel="noopener noreferrer">{label(lang, "openMaps")}</a>}
      </div>
    </div>
  );
}

/* ---------------- Buttons ---------------- */
export function Buttons({ block }: P) {
  const x = useFields(block);
  const list = items(x.raw("items")).filter((b) => str(b.label));
  const sample = list.length === 0;
  const show = sample ? [{ label: "Message me on WhatsApp", url: "" }] : list;
  return (
    <div className={`mfy-links mfy-links-${x.str("layout", "stack")} ${sample ? "mfy-ph" : ""}`}>
      {show.map((b, i) => {
        const href = safeHref(str(b.url));
        return href && !x.isStatic ? (
          <a key={i} className="mfy-linkbtn" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{str(b.label)}</a>
        ) : (
          <span key={i} className="mfy-linkbtn">{str(b.label)}</span>
        );
      })}
    </div>
  );
}

/* ---------------- Divider ---------------- */
export function Divider({ block }: P) {
  const style = typeof block.fields.style === "string" ? block.fields.style : "rangoli";
  return (
    <div className={`mfy-divider mfy-divider-${style}`} role="separator" aria-hidden="true">
      {style === "line" && <i />}
      {style === "stars" && <>{[0, 1, 2, 3, 4].map((n) => <svg key={n} viewBox="0 0 24 24" width={n === 2 ? 20 : 12} height={n === 2 ? 20 : 12}><path fill="currentColor" d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>)}</>}
      {style === "floral" && (
        <svg viewBox="0 0 240 28" width="240" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 14h84M152 14h84" /><circle cx="120" cy="14" r="4" fill="currentColor" />
          {[100, 140].map((c, i) => <g key={c} transform={`translate(${c} 14) scale(${i ? 1 : -1} 1)`}><path d="M0 0c-6-8-14-8-16 0 4 6 12 6 16 0z" /><path d="M-18 0c-6-8-14-8-16 0" opacity="0.6" /></g>)}
        </svg>
      )}
      {style === "rangoli" && (
        <svg viewBox="0 0 240 28" width="240" height="28" fill="currentColor">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => {
            const cx = 30 + n * 30, mid = n === 3;
            return <g key={n}><path d={`M${cx} ${14 - (mid ? 10 : 6)}l${mid ? 8 : 5} ${mid ? 10 : 6}l-${mid ? 8 : 5} ${mid ? 10 : 6}l-${mid ? 8 : 5} -${mid ? 10 : 6}z`} opacity={mid ? 1 : 0.55} />{!mid && <circle cx={cx + 15} cy="14" r="1.6" opacity="0.5" />}</g>;
          })}
        </svg>
      )}
    </div>
  );
}

export const MORE: Record<string, (p: P) => ReactElement> = {
  featured: Featured, timeline: Timeline, daysTogether: DaysTogether, video: Video,
  quote: Quote, reasons: Reasons, checklist: Checklist, openWhen: OpenWhen,
  reveal: Reveal, ask: Ask, quiz: Quiz, memory: Memory,
  event: Event, buttons: Buttons, divider: Divider,
};
