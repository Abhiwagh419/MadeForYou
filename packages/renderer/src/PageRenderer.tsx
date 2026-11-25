import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import type { AssetRef, Content } from "@madeforyou/schema";
import { BRAND, themeToCssVars } from "@madeforyou/ui";
import { Ambience } from "./Ambience";
import { BlockView } from "./blocks";
import { RenderCtx, type Host } from "./context";
import { Music } from "./Music";
import { Opening } from "./Opening";
import { useTapEffect } from "./Tap";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface PageRendererProps {
  content: Content;
  lang?: string;
  resolveAsset?: (ref: AssetRef) => string | undefined;
  skipOpening?: boolean;
  static?: boolean;
  host?: Host;
}

const noAssets = () => undefined;

export function PageRenderer({ content, lang, resolveAsset = noAssets, skipOpening = false, static: isStatic = false, host }: PageRendererProps) {
  const { settings } = content;
  const activeLang = lang ?? settings.languages.default;
  const gated = !isStatic && !skipOpening && settings.opening.kind !== "none";
  const [opened, setOpened] = useState(!gated);
  const [armed, setArmed] = useState(false);
  useIsoLayoutEffect(() => setArmed(!isStatic), [isStatic]);
  const tap = useTapEffect(isStatic ? "none" : settings.tap);

  const ctx = useMemo(
    () => ({ lang: activeLang, defaultLang: settings.languages.default, resolveAsset, isStatic, host }),
    [activeLang, settings.languages.default, resolveAsset, isStatic, host],
  );

  return (
    <RenderCtx.Provider value={ctx}>
      <div
        className={`mfy-page ${armed ? "mfy-armed" : ""} ${isStatic ? "mfy-static" : ""}`}
        data-theme={settings.theme.preset}
        lang={activeLang}
        style={themeToCssVars(settings.theme.preset) as CSSProperties}
      >
        {!opened ? (
          <Opening text={settings.opening.text || "Tap to open"} onOpen={() => setOpened(true)} />
        ) : (
          <>
            {!isStatic && <Ambience kind={settings.ambience.kind} intensity={settings.ambience.intensity} />}
            <main className="mfy-main" onPointerUp={tap.onPointerUp}>
              {content.blocks.filter((b) => b.visible).map((b) => (
                <BlockView key={b.id} block={b} />
              ))}
            </main>
            {tap.layerEl}
            <footer className="mfy-footer">
              {BRAND.domain ? <a href={`https://${BRAND.domain}`}>{BRAND.badgeText}</a> : <span>{BRAND.badgeText}</span>}
            </footer>
            {!isStatic && settings.music && <Music provider={settings.music.provider} id={settings.music.id} autoplay={gated} />}
          </>
        )}
      </div>
    </RenderCtx.Provider>
  );
}
