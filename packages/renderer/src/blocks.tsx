import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import type { Block } from "@madeforyou/schema";
import { useFields, useRender } from "./context";
import { label } from "./labels";
import { MORE } from "./more";
import { parseTarget } from "./util";

type P = { block: Block };

const paragraphs = (s: string) => s.split(/\n{2,}/).filter((p) => p.trim() !== "");
/** Index used by CSS to stagger entrances: style="--i: 2". */
const idx = (i: number) => ({ "--i": i }) as CSSProperties;

export function Hero({ block }: P) {
  const x = useFields(block);
  const layout = x.str("layout", "centered");
  const cover = x.ref(x.raw("cover"));
  const coverUrl = x.url(x.raw("cover"));
  const showFrame = !!cover || block.ph.includes("cover");
  const sub = x.t("subtitle");
  return (
    <div className={`mfy-hero mfy-hero-${layout}`}>
      {showFrame && (
        <div className="mfy-frame-wrap">
          <div className={`mfy-frame ${coverUrl ? "" : "mfy-frame-empty"}`}>
            {coverUrl && <img src={coverUrl} alt={cover?.alt ?? ""} decoding="async" />}
          </div>
        </div>
      )}
      <div className="mfy-hero-text">
        <h1 className={`mfy-hero-title ${x.ph("title")}`}>
          {x.t("title").split(/\s+/).filter(Boolean).map((w, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span className="mfy-word" style={idx(i)}>{w}</span>
            </Fragment>
          ))}
        </h1>
        <p className={`mfy-hero-recipient ${x.ph("recipient")}`}>{x.t("recipient")}</p>
        {sub && <p className={`mfy-hero-sub ${x.ph("subtitle")}`}>{sub}</p>}
      </div>
    </div>
  );
}

export function TextBlock({ block }: P) {
  const x = useFields(block);
  const heading = x.t("heading");
  return (
    <div className="mfy-text">
      {heading && <h2 className={`mfy-h2 ${x.ph("heading")}`}>{heading}</h2>}
      <div className={`mfy-prose ${x.ph("body")}`}>
        {paragraphs(x.t("body")).map((p, i) => (
          <p key={i} style={idx(i)}>{p}</p>
        ))}
      </div>
    </div>
  );
}

export function Letter({ block }: P) {
  const x = useFields(block);
  return (
    <article className={`mfy-letter mfy-paper-${x.str("paper", "cream")}`}>
      <p className={`mfy-salutation ${x.ph("salutation")}`}>{x.t("salutation")}</p>
      <div className={`mfy-letter-body ${x.ph("body")}`}>
        {paragraphs(x.t("body")).map((p, i) => (
          <p key={i} style={idx(i)}>{p}</p>
        ))}
      </div>
      <p className={`mfy-closing ${x.ph("closing")}`}>{x.t("closing")}</p>
    </article>
  );
}

interface GalleryItem {
  image?: unknown;
  caption?: string;
}

export function Gallery({ block }: P) {
  const x = useFields(block);
  const layout = x.str("layout", "grid");
  const raw = x.raw("items");
  const items: GalleryItem[] = Array.isArray(raw) ? (raw as GalleryItem[]) : [];
  const sample = items.length === 0;
  const list: GalleryItem[] = sample ? [{}, {}, {}, {}] : items;
  return (
    <ul className={`mfy-gallery mfy-gallery-${layout} ${sample ? "mfy-ph" : ""}`}>
      {list.map((it, i) => {
        const url = x.url(it.image);
        const alt = x.ref(it.image)?.alt ?? it.caption ?? "";
        return (
          <li key={i} className="mfy-tile" data-tone={i % 4} style={idx(i)} aria-hidden={sample || undefined}>
            <figure>
              {url ? <img src={url} alt={alt} loading="lazy" decoding="async" /> : <span className="mfy-tile-fill" />}
              {it.caption && <figcaption>{it.caption}</figcaption>}
            </figure>
          </li>
        );
      })}
    </ul>
  );
}

export { parseTarget };

export function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

function useNow(): number | null {
  // null until mounted, so server and first client render match.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Countdown({ block }: P) {
  const x = useFields(block);
  const { lang } = useRender();
  const now = useNow();
  const target = parseTarget(x.str("target"));
  const remaining = target !== null && now !== null ? target - now : null;
  const done = remaining !== null && remaining <= 0;
  const parts = remaining !== null ? splitRemaining(remaining) : null;
  const units: [string, number | null][] = [
    ["days", parts?.d ?? null], ["hours", parts?.h ?? null],
    ["minutes", parts?.m ?? null], ["seconds", parts?.s ?? null],
  ];
  return (
    <div className="mfy-countdown">
      <h2 className={`mfy-h2 ${x.ph("title")}`}>{x.t("title")}</h2>
      {target === null ? (
        <p className="mfy-ph mfy-count-empty">{label(lang, "pickDate")}</p>
      ) : done ? (
        <p className="mfy-count-done">{x.t("endMessage")}</p>
      ) : (
        <dl className={`mfy-count ${x.ph("target")}`}>
          {units.map(([k, v]) => (
            <div key={k}>
              <dt>{label(lang, k)}</dt>
              <dd key={v === null ? "-" : v}>{v === null ? "–" : String(v).padStart(2, "0")}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function Signature({ block }: P) {
  const x = useFields(block);
  return (
    <div className="mfy-signature">
      <p className={`mfy-sign-msg ${x.ph("message")}`}>{x.t("message")}</p>
      <p className={`mfy-sign-name ${x.ph("name")}`}>{x.t("name")}</p>
    </div>
  );
}

export const COMPONENTS: Record<string, (p: P) => ReactElement> = {
  hero: Hero,
  text: TextBlock,
  letter: Letter,
  gallery: Gallery,
  countdown: Countdown,
  signature: Signature,
  ...MORE,
};

/**
 * Wraps every block. `data-in` flips to true once the block scrolls into view;
 * CSS uses it to play entrances at the moment they can be seen (not on page load,
 * when below-the-fold blocks would animate where nobody is looking).
 */
export function BlockView({ block }: P) {
  const C = COMPONENTS[block.type];
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!C) return null; // validation rejects unknown types; this is only a safety net
  const s = block.style;
  return (
    <section
      ref={ref}
      id={block.id}
      data-block={block.type}
      data-in={seen}
      data-reveal={s.anim === "none" ? undefined : s.anim}
      className={`mfy-block mfy-bg-${s.bg} mfy-space-${s.space} mfy-align-${s.align}`}
    >
      <div className="mfy-inner">
        <C block={block} />
      </div>
    </section>
  );
}
