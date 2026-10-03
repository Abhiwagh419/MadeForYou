import { useEffect, useState, type ReactElement } from "react";
import type { Block } from "@madeforyou/schema";
import { useFields, useRender } from "./context";
import { label } from "./labels";

type P = { block: Block };

const paragraphs = (s: string) => s.split(/\n{2,}/).filter((p) => p.trim() !== "");

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
        <div className={`mfy-frame ${coverUrl ? "" : `mfy-frame-empty ${x.ph("cover")}`}`}>
          {coverUrl && <img src={coverUrl} alt={cover?.alt ?? ""} decoding="async" />}
        </div>
      )}
      <div className="mfy-hero-text">
        <h1 className={`mfy-hero-title ${x.ph("title")}`}>{x.t("title")}</h1>
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
          <p key={i}>{p}</p>
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
          <p key={i}>{p}</p>
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
          <li key={i} className="mfy-tile" data-tone={i % 4} aria-hidden={sample || undefined}>
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

/** A date-only target means midnight in India (IST), the default for this product. */
export function parseTarget(v: string): number | null {
  if (!v) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+05:30` : v;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

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
              <dd>{v === null ? "–" : String(v).padStart(2, "0")}</dd>
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
};

export function BlockView({ block }: P) {
  const C = COMPONENTS[block.type];
  if (!C) return null; // validation rejects unknown types; this is only a safety net
  const s = block.style;
  return (
    <section
      id={block.id}
      data-block={block.type}
      className={`mfy-block mfy-bg-${s.bg} mfy-space-${s.space} mfy-align-${s.align} mfy-anim-${s.anim}`}
    >
      <div className="mfy-inner">
        <C block={block} />
      </div>
    </section>
  );
}
