import type { CSSProperties } from "react";

/**
 * Decorative particles. Positions come from the index (no Math.random) so server and
 * client renders match. Hidden entirely for people who prefer reduced motion (see CSS).
 * "diyas" falls back to a warm twinkle until its own artwork exists.
 */
export function Ambience({ kind, intensity }: { kind: string; intensity: "low" | "medium" }) {
  if (kind === "none") return null;
  const count = intensity === "medium" ? 18 : 10;
  return (
    <div className="mfy-ambience" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const style = {
          left: `${(i * 37 + 11) % 100}%`,
          width: `${8 + ((i * 5) % 9)}px`,
          height: `${8 + ((i * 5) % 9)}px`,
          animationDelay: `${-((i * 9) % 70) / 10}s`,
          animationDuration: `${9 + ((i * 13) % 7)}s`,
          top: kind === "stars" || kind === "diyas" ? `${(i * 29 + 7) % 90}%` : undefined,
        } as CSSProperties;
        return <span key={i} className={`mfy-amb mfy-amb-${kind}`} data-v={i % 3} style={style} />;
      })}
    </div>
  );
}
