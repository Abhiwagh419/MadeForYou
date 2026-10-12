import { useRef, useState, type ReactNode } from "react";
import { defaultValue, isSafeLink, normalizeLink, parseVideoUrl, type AssetRef, type FieldDef, type VideoRef } from "@madeforyou/schema";
import { saveImage, useAssetUrl } from "../lib/assets";
import { fromIstInput, humanize, toIstInput } from "../lib/util";
import { Icon } from "./Icon";
import { Segmented, toast } from "./Controls";

export function Field({ label, hint, right, children }: { label?: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      {(label || right) && (
        <div className="field-head">
          {label && <label>{label}</label>}
          {right && <span className="field-right">{right}</span>}
        </div>
      )}
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/* ---------- one image, with a description for screen readers ---------- */
export function ImageInput({ value, onChange, large, showAlt = true }: { value: AssetRef | null | undefined; onChange: (v: AssetRef | null) => void; large?: boolean; showAlt?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const url = useAssetUrl(value?.asset);

  const take = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const ref = await saveImage(f);
      onChange({ asset: ref.asset, alt: value?.alt });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="imgin">
      <div
        className={`drop ${large ? "drop-lg" : ""} ${over ? "over" : ""}`} data-filled={!!value}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
      >
        {value && url ? <img src={url} alt="" /> : (
          <button type="button" className="drop-empty" onClick={() => file.current?.click()}>
            <Icon name="image" size={large ? 28 : 22} />
            <span>{busy ? "Preparing…" : "Add a photo"}</span>
            <small>Tap to choose, or drop one here</small>
          </button>
        )}
        {value && (
          <div className="drop-actions">
            <button type="button" onClick={() => file.current?.click()}><Icon name="pencil" size={15} />Replace</button>
            <button type="button" onClick={() => onChange(null)}><Icon name="trash" size={15} />Remove</button>
          </div>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {value && showAlt && (
        <input className="in in-sm" placeholder="Describe the photo, for people using screen readers" maxLength={200}
          value={value.alt ?? ""} onChange={(e) => onChange({ ...value, alt: e.target.value })} aria-label="Photo description" />
      )}
    </div>
  );
}

/* ---------- a link, tidied as you leave the box ---------- */
function LinkInput({ value, onChange, small, large, label }: { value: string; onChange: (v: string) => void; small?: boolean; large?: boolean; label: string }) {
  const [draft, setDraft] = useState(value);
  const bad = draft !== "" && !isSafeLink(normalizeLink(draft));
  return (
    <>
      <input className={`in ${small ? "in-sm" : ""} ${large ? "in-lg" : ""}`} inputMode="url" autoCapitalize="none" spellCheck={false} aria-label={label}
        placeholder="https://… or a phone number or an email" value={draft}
        onChange={(e) => { setDraft(e.target.value); const n = normalizeLink(e.target.value); if (isSafeLink(n)) onChange(n); }}
        onBlur={() => { const n = normalizeLink(draft); if (isSafeLink(n)) { setDraft(n); onChange(n); } }} />
      {bad && <p className="field-error">Use a web link, a phone number or an email address</p>}
    </>
  );
}

/* ---------- a YouTube or Vimeo link, stored as provider + id ---------- */
function EmbedInput({ value, onChange, large }: { value: VideoRef | null | undefined; onChange: (v: VideoRef | null) => void; large?: boolean }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  if (value) {
    return (
      <div className="embed-chip">
        <Icon name="video" size={16} />
        <span>{value.provider === "youtube" ? "YouTube" : "Vimeo"} video added</span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onChange(null)} aria-label="Remove video"><Icon name="x" size={16} /></button>
      </div>
    );
  }
  const add = (text: string) => {
    const v = parseVideoUrl(text);
    if (v) { setError(""); setDraft(""); onChange(v); } else if (text.trim()) setError("Paste a YouTube or Vimeo link");
  };
  return (
    <>
      <input className={`in ${large ? "in-lg" : "in-sm"}`} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="Paste a YouTube or Vimeo link" value={draft} aria-label="Video link"
        onChange={(e) => { setDraft(e.target.value); if (parseVideoUrl(e.target.value)) add(e.target.value); }} onBlur={() => add(draft)} />
      {error && <p className="field-error">{error}</p>}
    </>
  );
}

/* ---------- list of items (gallery photos) ---------- */
function Thumbnail({ id }: { id?: string }) {
  const url = useAssetUrl(id);
  return <div className="li-thumb">{url ? <img src={url} alt="" /> : <Icon name="image" size={18} />}</div>;
}

export function ListInput({ def, value, onChange, large }: { def: Extract<FieldDef, { kind: "list" }>; value: unknown; onChange: (v: unknown[]) => void; large?: boolean }) {
  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const imageKey = Object.entries(def.item).find(([, d]) => d.kind === "image")?.[0];
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const room = def.max - items.length;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || !imageKey) return;
    setBusy(true);
    try {
      const take = [...files].slice(0, room);
      const refs: AssetRef[] = [];
      for (const f of take) refs.push(await saveImage(f));
      onChange([...items, ...refs.map((r) => ({ [imageKey]: r }))]);
      if (files.length > room) toast(`Only ${def.max} photos fit here, so the rest were skipped`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const patch = (i: number, k: string, v: unknown) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className={`listin ${large ? "listin-lg" : ""}`}>
      {items.map((it, i) => (
        <div className="li" key={i}>
          {imageKey && <Thumbnail id={(it[imageKey] as AssetRef | null | undefined)?.asset} />}
          <div className="li-fields">
            {Object.entries(def.item).filter(([, d]) => d.kind !== "image").map(([k, d]) => {
              const v = it[k];
              const ph = d.prompt ?? humanize(k);
              if (d.kind === "longtext") return <textarea key={k} className="in in-sm in-area" rows={2} placeholder={ph} maxLength={d.max} value={(v as string) ?? ""} onChange={(e) => patch(i, k, e.target.value)} aria-label={humanize(k)} />;
              if (d.kind === "enum") return (
                <select key={k} className="in in-sm" value={String(v ?? d.default)} onChange={(e) => patch(i, k, e.target.value)} aria-label={humanize(k)}>
                  {d.options.map((o) => <option key={o} value={o}>{k === "correct" ? `Right answer: ${o}` : humanize(o)}</option>)}
                </select>
              );
              if (d.kind === "url") return <LinkInput key={k} small label={humanize(k)} value={(v as string) ?? ""} onChange={(n) => patch(i, k, n)} />;
              return <input key={k} className="in in-sm" placeholder={ph} maxLength={d.kind === "text" ? d.max : undefined} value={(v as string) ?? ""} onChange={(e) => patch(i, k, e.target.value)} aria-label={humanize(k)} />;
            })}
            {imageKey && (it[imageKey] as AssetRef | undefined) && (
              <input className="in in-sm" placeholder="Describe the photo (alt text)" maxLength={200}
                value={(it[imageKey] as AssetRef).alt ?? ""} onChange={(e) => patch(i, imageKey, { ...(it[imageKey] as AssetRef), alt: e.target.value })} aria-label="Photo description" />
            )}
          </div>
          <div className="li-actions">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={16} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down"><Icon name="down" size={16} /></button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={16} /></button>
          </div>
        </div>
      ))}
      {room > 0 && (
        <button type="button" className="li-add" onClick={() => (imageKey && Object.keys(def.item).length === 1 ? file.current?.click() : imageKey ? file.current?.click() : onChange([...items, Object.fromEntries(Object.entries(def.item).filter(([, d]) => d.kind === "enum").map(([k, d]) => [k, defaultValue(d)]))]))}>
          <Icon name={imageKey ? "image" : "plus"} size={20} />
          <span>{busy ? "Preparing…" : imageKey ? (items.length ? "Add more photos" : "Add photos") : "Add item"}</span>
          <small>{items.length} of {def.max}</small>
        </button>
      )}
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/* ---------- any field, by kind ---------- */
export function FieldInput({
  name, def, value, isPh, onChange, large, disabledNote,
}: {
  name: string; def: FieldDef; value: unknown; isPh: boolean; onChange: (v: unknown) => void; large?: boolean; disabledNote?: string;
}) {
  const label = humanize(name);
  if (disabledNote) {
    return <Field label={label}><p className="field-note">{disabledNote}</p></Field>;
  }
  const shown = isPh ? "" : value;
  const sample = typeof def.placeholder === "string" ? def.placeholder : "";

  switch (def.kind) {
    case "text":
      return (
        <Field label={large ? undefined : label} right={<span className="count">{String(shown ?? "").length}/{def.max}</span>}>
          <input className={`in ${large ? "in-lg" : ""}`} value={String(shown ?? "")} maxLength={def.max} placeholder={sample} autoFocus={large}
            onChange={(e) => onChange(e.target.value)} aria-label={label} />
        </Field>
      );
    case "longtext":
      return (
        <Field label={large ? undefined : label} right={<span className="count">{String(shown ?? "").length}/{def.max}</span>}>
          <textarea className={`in ${large ? "in-lg" : ""}`} rows={large ? 9 : 5} value={String(shown ?? "")} maxLength={def.max} placeholder={sample} autoFocus={large}
            onChange={(e) => onChange(e.target.value)} aria-label={label} />
        </Field>
      );
    case "image":
      return <Field label={large ? undefined : label}><ImageInput large={large} value={value as AssetRef | null} onChange={onChange} /></Field>;
    case "date":
      return (
        <Field label={large ? undefined : label} hint={def.withTime ? "India time (IST)" : undefined}>
          {def.withTime ? (
            <input className={`in ${large ? "in-lg" : ""}`} type="datetime-local" value={toIstInput(value)} onChange={(e) => onChange(fromIstInput(e.target.value))} aria-label={label} />
          ) : (
            <input className={`in ${large ? "in-lg" : ""}`} type="date" value={typeof value === "string" ? value.slice(0, 10) : ""} onChange={(e) => onChange(e.target.value || null)} aria-label={label} />
          )}
        </Field>
      );
    case "url":
      return <Field label={large ? undefined : label}><LinkInput large={large} label={label} value={String(shown ?? "")} onChange={onChange} /></Field>;
    case "embed":
      return <Field label={large ? undefined : label}><EmbedInput large={large} value={value as VideoRef | null} onChange={onChange} /></Field>;
    case "enum":
      return (
        <Field label={label}>
          <Segmented value={String(value ?? def.default)} onChange={onChange} label={label}
            options={def.options.map((o) => ({ value: o, label: humanize(o) }))} />
        </Field>
      );
    case "list":
      return <Field label={large ? undefined : label}><ListInput def={def} value={value} onChange={onChange} large={large} /></Field>;
  }
}
