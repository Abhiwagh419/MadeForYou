import { createContext, useContext } from "react";
import type { AssetRef, Block } from "@madeforyou/schema";

export interface RenderContext {
  lang: string;
  defaultLang: string;
  /** The host app turns an asset reference into a URL (public, or signed for private pages). */
  resolveAsset: (ref: AssetRef) => string | undefined;
}

export const RenderCtx = createContext<RenderContext>({
  lang: "en",
  defaultLang: "en",
  resolveAsset: () => undefined,
});

export const useRender = () => useContext(RenderCtx);

const isRef = (v: unknown): v is AssetRef =>
  !!v && typeof v === "object" && typeof (v as AssetRef).asset === "string";

/** Small accessor so block components stay free of casts and language logic. */
export function useFields(block: Block) {
  const { lang, defaultLang, resolveAsset } = useRender();
  const raw = (field: string): unknown => block.fields[field];
  return {
    raw,
    /** Text for the current language, falling back to the page's default language. */
    t(field: string): string {
      const alt = lang !== defaultLang ? block.i18n?.[lang]?.[field] : undefined;
      const v = alt ?? raw(field);
      return typeof v === "string" ? v : "";
    },
    str(field: string, fallback = ""): string {
      const v = raw(field);
      return typeof v === "string" && v ? v : fallback;
    },
    /** "mfy-ph" while the field still holds sample content, so it renders greyed. */
    ph: (field: string) => (block.ph.includes(field) ? "mfy-ph" : ""),
    ref: (v: unknown): AssetRef | null => (isRef(v) ? v : null),
    url: (v: unknown): string | undefined => (isRef(v) ? resolveAsset(v) : undefined),
  };
}
