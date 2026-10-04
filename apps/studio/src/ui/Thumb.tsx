import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PageRenderer } from "@madeforyou/renderer";
import type { Content } from "@madeforyou/schema";
import { useAssets } from "../lib/assets";
import { useInView } from "./Controls";

const W = 390;
const H = 600;

/** A live, non-animated miniature of a page. Rendered only once it scrolls into view. */
export function Thumb({ content, lang, className = "" }: { content: Content; lang?: string; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const resolve = useAssets(content);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / W || 0.5);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={(n) => { box.current = n; (ref as { current: HTMLDivElement | null }).current = n; }} className={`thumb ${className}`} style={{ aspectRatio: `${W} / ${H}` }}>
      {seen && (
        <div className="thumb-inner" style={{ width: W, height: H, scale: String(scale), "--mfy-screen": "0px" } as CSSProperties} aria-hidden="true">
          <PageRenderer static skipOpening content={content} lang={lang} resolveAsset={resolve} />
        </div>
      )}
    </div>
  );
}

/** A phone bezel around a Thumb, for hero imagery. */
export function PhoneThumb({ content, className = "", style }: { content: Content; className?: string; style?: CSSProperties }) {
  return (
    <div className={`phone-thumb ${className}`} style={style}>
      <Thumb content={content} />
    </div>
  );
}
