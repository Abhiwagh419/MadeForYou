import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import type { AssetRef, Content } from "@madeforyou/schema";
import { BRAND, themeToCssVars } from "@madeforyou/ui";
import { Ambience } from "./Ambience";
import { BlockView } from "./blocks";
import { RenderCtx } from "./context";
import { Music } from "./Music";
import { Opening } from "./Opening";
import { useTapEffect } from "./Tap";

// useLayoutEffect warns on the server; this picks the right one for each side.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface PageRendererProps {
  content: Content;
  /** Language to show; falls back to the page's default language. */
  lang?: string;
  /** Turns an asset reference into a URL. Supplied by the host app. */
  resolveAsset?: (ref: AssetRef) => string | undefined;
  /** Skip the opening screen (editor preview, screenshots). */
  skipOpening?: boolean;
}

const noAssets = () => undefined;

export function PageRenderer({ content, lang, resolveAsset = noAssets, skipOpening = false }: PageRendererProps) {
  const { settings } = content;
  const activeLang = lang ?? settings.languages.default;
  const gated = !skipOpening && settings.opening.kind !== "none";
  const [opened, setOpened] = useState(!gated);
  // Entrances only hide content once scripts are running, so a page without JS still shows everything.
  const [armed, setArmed] = useState(false);
  useIsoLayoutEffect(() => setArmed(true), []);
  const tap = useTapEffect(settings.tap);

  const ctx = useMemo(
    () => ({ lang: activeLang, defaultLang: settings.languages.default, resolveAsset }),
    [activeLang, settings.languages.default, resolveAsset],
  );

  return (
    <RenderCtx.Provider value={ctx}>
      <div
        className={`mfy-page ${armed ? "mfy-armed" : ""}`}
        data-theme={settings.theme.preset}
        lang={activeLang}
        style={themeToCssVars(settings.theme.preset) as CSSProperties}
      >
        {!opened ? (
          <Opening text={settings.opening.text || "Tap to open"} onOpen={() => setOpened(true)} />
        ) : (
          <>
            <Ambience kind={settings.ambience.kind} intensity={settings.ambience.intensity} />
            <main className="mfy-main" onPointerUp={tap.onPointerUp}>
              {content.blocks.filter((b) => b.visible).map((b) => (
                <BlockView key={b.id} block={b} />
              ))}
            </main>
            {tap.layerEl}
            <footer className="mfy-footer">
              {/* Always on: with no ads and no paid tier, this is the growth loop. */}
              {BRAND.domain ? <a href={`https://${BRAND.domain}`}>{BRAND.badgeText}</a> : <span>{BRAND.badgeText}</span>}
            </footer>
            {settings.music && <Music provider={settings.music.provider} id={settings.music.id} autoplay={gated} />}
          </>
        )}
      </div>
    </RenderCtx.Provider>
  );
}
