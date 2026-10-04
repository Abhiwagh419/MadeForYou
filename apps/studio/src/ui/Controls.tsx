import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: IconName; hint?: string }[];
  label?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? "on" : ""} title={o.hint} onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch">
      <span className="switch-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true"><i /></span>
    </label>
  );
}

/* ---------- Modal / bottom sheet ---------- */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <span className="sheet-grab" aria-hidden="true" />
        <header>
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
let toasts: { id: number; text: string }[] = [];
const subs = new Set<() => void>();
let n = 0;
export function toast(text: string) {
  const id = n++;
  toasts = [...toasts, { id, text }];
  subs.forEach((s) => s());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    subs.forEach((s) => s());
  }, 2600);
}
export function Toaster() {
  const list = useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => toasts, () => toasts);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => <div key={t.id} className="toast"><Icon name="check" size={16} />{t.text}</div>)}
    </div>
  );
}

/* ---------- media query hook ---------- */
export function useMedia(query: string, fallback = false): boolean {
  const get = () => (typeof matchMedia === "function" ? matchMedia(query).matches : fallback);
  const [v, setV] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(query);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    on();
    return () => m.removeEventListener("change", on);
  }, [query]);
  return v;
}

/* ---------- in-view hook (lazy thumbnails) ---------- */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}
