import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from "react";

interface Burst {
  id: number;
  x: number;
  y: number;
}

const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1.1 4.2 2.4h3.6C14.6 6.1 16 5 18 5c3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z";
const SPARKLE = "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z";

/**
 * Tap effect: a small heart or sparkle floats up where the visitor taps.
 * Pure CSS motion; at most 10 on screen; skipped for reduced motion and for taps on links or controls.
 */
export function useTapEffect(kind: "none" | "hearts" | "sparkles") {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const layer = useRef<HTMLDivElement>(null);
  const next = useRef(0);

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (kind === "none" || !layer.current) return;
      if ((e.target as Element).closest("a, button, input, textarea, select, iframe, [role=button]")) return;
      if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = layer.current.getBoundingClientRect();
      const id = next.current++;
      setBursts((b) => [...b.slice(-9), { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    },
    [kind],
  );

  const layerEl = kind === "none" ? null : (
    <div ref={layer} className="mfy-taps" aria-hidden="true">
      {bursts.map((b) => (
        <svg
          key={b.id}
          className="mfy-tap"
          data-v={b.id % 3}
          viewBox="0 0 24 24"
          width="26"
          height="26"
          style={{ left: b.x, top: b.y, "--dx": `${((b.id * 37) % 70) - 35}px` } as CSSProperties}
          onAnimationEnd={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
        >
          <path fill="currentColor" d={kind === "hearts" ? HEART : SPARKLE} />
        </svg>
      ))}
    </div>
  );

  return { onPointerUp, layerEl };
}
