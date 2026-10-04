import { forwardRef, useEffect, type CSSProperties } from "react";
import { PageRenderer } from "@madeforyou/renderer";
import type { Content } from "@madeforyou/schema";
import { useAssets } from "../lib/assets";

interface Props {
  content: Content;
  lang?: string;
  skipOpening?: boolean;
  device?: "phone" | "tablet";
  selectedId?: string | null;
  onSelectBlock?: (id: string) => void;
  /** Changing this remounts the page so animations replay. */
  replayKey?: number;
}

/**
 * A phone-sized window onto a page. The inner box is the containing block for the page's
 * fixed layers (petals, music), so they stay inside the frame.
 */
export const PhonePreview = forwardRef<HTMLDivElement, Props>(function PhonePreview(
  { content, lang, skipOpening, device = "phone", selectedId, onSelectBlock, replayKey = 0 }, scrollerRef,
) {
  const resolve = useAssets(content);

  useEffect(() => {
    const scroller = (scrollerRef as { current: HTMLDivElement | null } | null)?.current;
    scroller?.querySelectorAll("[data-selected]").forEach((n) => n.removeAttribute("data-selected"));
    if (selectedId) scroller?.querySelector(`[id="${selectedId}"]`)?.setAttribute("data-selected", "true");
  });

  return (
    <div className={`device device-${device}`}>
      <div className="device-screen" style={{ "--mfy-screen": "var(--screen-h)" } as CSSProperties}>
        <div
          className="device-scroll" ref={scrollerRef}
          onClick={(e) => {
            if (!onSelectBlock) return;
            const sec = (e.target as Element).closest("section[data-block]");
            if (sec?.id) onSelectBlock(sec.id);
          }}
        >
          <PageRenderer key={`${replayKey}-${skipOpening}`} content={content} lang={lang} skipOpening={skipOpening} resolveAsset={resolve} />
        </div>
      </div>
    </div>
  );
});
