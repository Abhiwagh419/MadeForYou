import { useState } from "react";
import { registry, setField, type Block, type Content, type Style } from "@madeforyou/schema";
import { THEMES } from "@madeforyou/ui";
import { parseMusic } from "../lib/util";
import { setSettings, setStyle, type EditorAction } from "../state/editor";
import { Button } from "../ui/Button";
import { Segmented, Switch } from "../ui/Controls";
import { Field, FieldInput, frameLock } from "../ui/Fields";
import { Icon } from "../ui/Icon";
import { BLOCK_INFO } from "./blockInfo";

type Dispatch = (a: EditorAction) => void;

export function BlockInspector({
  block, theme, lang, defaultLang, dispatch, onDuplicate, onDelete,
}: {
  block: Block; theme: string; lang: string; defaultLang: string; dispatch: Dispatch; onDuplicate: () => void; onDelete: () => void;
}) {
  const def = registry[block.type];
  if (!def) return null;
  const translating = lang !== defaultLang;
  const apply = (fn: (c: Content) => Content, key?: string) => dispatch({ type: "apply", fn, key });

  return (
    <div className="inspector">
      <div className="insp-head">
        <span className="bl-icon"><Icon name={BLOCK_INFO[block.type]?.icon ?? "layers"} size={18} /></span>
        <div>
          <strong>{def.label}</strong>
          <small>{BLOCK_INFO[block.type]?.desc}</small>
        </div>
        <span className="insp-actions">
          <Button variant="ghost" size="sm" icon="copy" aria-label="Duplicate block" onClick={onDuplicate} />
          <Button variant="ghost" size="sm" icon="trash" aria-label="Delete block" onClick={onDelete} />
        </span>
      </div>

      {translating && <p className="note-box"><Icon name="globe" size={16} />You are writing the <b>{lang === "hi" ? "Hindi" : lang}</b> version. Photos, dates and layout stay the same in every language.</p>}

      {Object.entries(def.fields).map(([name, f]) => {
        const isText = f.kind === "text" || f.kind === "longtext";
        if (translating && !isText) return null;
        const value = translating ? block.i18n?.[lang]?.[name] ?? "" : block.fields[name];
        const shown = translating ? { ...f, placeholder: String(block.fields[name] ?? "") } : f;
        return (
          <FieldInput key={`${block.id}-${name}-${lang}`} name={name} def={shown} value={value} lock={frameLock(block, name, theme)}
            isPh={translating ? false : block.ph.includes(name)}
            onChange={(v) => apply((c) => setField(c, block.id, name, v, translating ? lang : undefined), `f:${block.id}:${name}:${lang}`)} />
        );
      })}

      {!translating && (
        <details className="group">
          <summary>Style <small>alignment, spacing, entrance</small></summary>
          <Field label="Alignment">
            <Segmented<Style["align"]> value={block.style.align} onChange={(v) => apply((c) => setStyle(c, block.id, { align: v }))}
              options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} />
          </Field>
          <Field label="Spacing">
            <Segmented<Style["space"]> value={block.style.space} onChange={(v) => apply((c) => setStyle(c, block.id, { space: v }))}
              options={[{ value: "sm", label: "Tight" }, { value: "md", label: "Roomy" }, { value: "lg", label: "Airy" }]} />
          </Field>
          <Field label="Background">
            <Segmented<Style["bg"]> value={block.style.bg} onChange={(v) => apply((c) => setStyle(c, block.id, { bg: v }))}
              options={[{ value: "default", label: "Plain" }, { value: "soft", label: "Tinted" }, { value: "accent", label: "Bold" }]} />
          </Field>
          <Field label="When it appears" hint="Plays as the visitor scrolls to it. Skipped for people who prefer reduced motion.">
            <Segmented<Style["anim"]> value={block.style.anim} onChange={(v) => apply((c) => setStyle(c, block.id, { anim: v }))}
              options={[{ value: "none", label: "Still" }, { value: "fade", label: "Fade" }, { value: "fade-up", label: "Rise" }, { value: "zoom", label: "Zoom" }]} />
          </Field>
        </details>
      )}
    </div>
  );
}

export function DesignPanel({ content, dispatch }: { content: Content; dispatch: Dispatch }) {
  const s = content.settings;
  const [musicText, setMusicText] = useState("");
  const [musicError, setMusicError] = useState("");
  const set = (patch: Parameters<typeof setSettings>[1]) => dispatch({ type: "apply", fn: (c) => setSettings(c, patch) });

  const addMusic = () => {
    const m = parseMusic(musicText);
    if (!m) return setMusicError("Paste a YouTube or Spotify track link");
    setMusicError("");
    setMusicText("");
    set({ music: m });
  };

  return (
    <div className="inspector">
      <Field label="Theme">
        <div className="themes">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} type="button" className={`theme ${s.theme.preset === key ? "on" : ""}`} onClick={() => set({ theme: { preset: key } })} aria-pressed={s.theme.preset === key}>
              <span className="theme-sw" style={{ background: t.bg }}>
                <i style={{ background: t.primary }} /><i style={{ background: t.accent }} />
                <b style={{ fontFamily: t.fontHeading, color: t.text }}>Aa</b>
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Opening screen" hint="The visitor taps to open. That tap also lets music start on phones.">
        <Segmented value={s.opening.kind === "none" ? "none" : "envelope"} onChange={(v) => set({ opening: { ...s.opening, kind: v === "none" ? "none" : "envelope" } })}
          options={[{ value: "none", label: "None" }, { value: "envelope", label: "Envelope" }]} />
        {s.opening.kind !== "none" && (
          <input className="in in-sm" style={{ marginTop: 8 }} value={s.opening.text ?? ""} maxLength={60} placeholder="Tap to open"
            onChange={(e) => set({ opening: { ...s.opening, text: e.target.value } })} aria-label="Opening screen text" />
        )}
      </Field>

      <Field label="Falling in the background">
        <Segmented value={s.ambience.kind} onChange={(v) => set({ ambience: { ...s.ambience, kind: v } })}
          options={[{ value: "none", label: "None" }, { value: "petals", label: "Petals" }, { value: "confetti", label: "Confetti" }, { value: "stars", label: "Stars" }, { value: "diyas", label: "Diyas" }]} />
      </Field>

      <Field label="When they tap the page" hint="Hearts suit love and thanks. Leave it off for serious pages.">
        <Segmented value={s.tap} onChange={(v) => set({ tap: v })}
          options={[{ value: "none", label: "Nothing" }, { value: "hearts", label: "Hearts" }, { value: "sparkles", label: "Sparkles" }]} />
      </Field>

      <Field label="Background music" hint="We play it through YouTube or Spotify. Nothing is uploaded.">
        {s.music ? (
          <div className="music-chip">
            <Icon name="music" size={16} />
            <span>{s.music.provider === "youtube" ? "YouTube" : "Spotify"} track added</span>
            <Button variant="ghost" size="sm" icon="x" aria-label="Remove music" onClick={() => set({ music: undefined })} />
          </div>
        ) : (
          <>
            <div className="inline-form">
              <input className="in in-sm" value={musicText} placeholder="Paste a YouTube or Spotify link" onChange={(e) => setMusicText(e.target.value)} aria-label="Music link"
                onKeyDown={(e) => e.key === "Enter" && addMusic()} />
              <Button size="sm" variant="secondary" onClick={addMusic}>Add</Button>
            </div>
            {musicError && <p className="field-error">{musicError}</p>}
          </>
        )}
      </Field>
    </div>
  );
}

const LANGS: [string, string][] = [["hi", "हिन्दी (Hindi)"], ["mr", "मराठी (Marathi)"], ["gu", "ગુજરાતી (Gujarati)"], ["ta", "தமிழ் (Tamil)"], ["bn", "বাংলা (Bengali)"], ["te", "తెలుగు (Telugu)"]];

export function SettingsPanel({ content, dispatch, onDeletePage }: { content: Content; dispatch: Dispatch; onDeletePage: () => void }) {
  const langs = content.settings.languages;
  const toggle = (code: string, on: boolean) =>
    dispatch({
      type: "apply",
      fn: (c) => setSettings(c, { languages: { ...langs, available: on ? [...new Set([...langs.available, code])] : langs.available.filter((l) => l !== code) } }),
    });
  return (
    <div className="inspector">
      <Field label="Languages" hint="Visitors can switch between them. English is always the base; then write each block's other versions from the language switch above the preview.">
        <div className="switches">
          {LANGS.map(([code, name]) => (
            <Switch key={code} label={name} checked={langs.available.includes(code)} onChange={(v) => toggle(code, v)} />
          ))}
        </div>
      </Field>
      <div className="danger-zone">
        <Button variant="danger" size="sm" icon="trash" onClick={onDeletePage}>Delete this page</Button>
      </div>
    </div>
  );
}
