import { useCallback, useEffect, useRef, useState } from "react";
import { cropToBlob, fitRect, moveRect, resizeCorner, scaleRect, type Corner, type Rect } from "../lib/crop";
import { Sheet, toast } from "./Controls";

const SHAPES: { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "Square", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:9", ratio: 16 / 9 },
];
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

type Drag = { kind: "move" | Corner; sx: number; sy: number; start: Rect };

export function CropDialog({ src, onCancel, onDone, onWhole, lock }: {
  src: string;
  onCancel: () => void;
  onDone: (r: { blob: Blob; ratio: number }) => void;
  onWhole?: () => void;
  lock?: number;
}) {
  const img = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ratio, setRatio] = useState<number | null>(lock ?? null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<Drag | null>(null);
  const boxRef = useRef(box);
  boxRef.current = box;

  const measure = useCallback(() => {
    const el = img.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const next = { w: b.width, h: b.height };
    const prev = boxRef.current;
    setBox(next);
    setRect((r) => (r && prev ? scaleRect(r, next.w / prev.w, next.h / prev.h) : fitRect(next.w, next.h, lock ?? null)));
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const pick = (r: number | null) => {
    setRatio(r);
    if (box) setRect(fitRect(box.w, box.h, r));
  };

  const down = (kind: Drag["kind"]) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, sx: e.clientX, sy: e.clientY, start: rect };
  };
  const moveP = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !box) return;
    if (d.kind === "move") {
      setRect(moveRect(d.start, e.clientX - d.sx, e.clientY - d.sy, box.w, box.h));
      return;
    }
    const b = img.current!.getBoundingClientRect();
    setRect(resizeCorner(d.start, d.kind, e.clientX - b.left, e.clientY - b.top, ratio, box.w, box.h));
  };
  const up = () => { drag.current = null; };

  const nudge = (e: React.KeyboardEvent) => {
    if (!rect || !box) return;
    const step = e.shiftKey ? 20 : 4;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    setRect(moveRect(rect, v[0], v[1], box.w, box.h));
  };

  const save = async () => {
    if (!rect || !box || !img.current) return;
    setBusy(true);
    try {
      onDone(await cropToBlob(img.current, rect, box.w, box.h));
    } catch (e) {
      toast((e as Error).message || "Could not crop this photo");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onCancel} title="Choose the part to show" wide>
      <div className="crop">
        {lock ? (
          <p className="note-box">This photo sits in a frame of a fixed shape, so the box keeps that shape. Move it and resize it to choose what shows.</p>
        ) : (
          <div className="crop-shapes" role="radiogroup" aria-label="Shape">
            {SHAPES.map((s) => (
              <button key={s.label} type="button" role="radio" aria-checked={ratio === s.ratio} className={ratio === s.ratio ? "on" : ""} onClick={() => pick(s.ratio)}>{s.label}</button>
            ))}
          </div>
        )}
        <div className="crop-stage">
          <div className="crop-inner">
            <img ref={img} src={src} alt="" draggable={false} onLoad={measure} />
            {rect && (
              <div className="crop-box" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                tabIndex={0} role="group" aria-label="Crop area. Use the arrow keys to move it."
                onPointerDown={down("move")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} onKeyDown={nudge}>
                <i className="crop-grid" aria-hidden="true" />
                {CORNERS.map((c) => (
                  <span key={c} className={`crop-h crop-${c}`} onPointerDown={down(c)} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="field-hint">Drag the box to move it. Drag a corner to make it bigger or smaller.</p>
        <div className="crop-actions">
          {onWhole && !lock && <button type="button" className="btn btn-ghost" onClick={onWhole} disabled={busy}>Use the whole photo</button>}
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !rect}>{busy ? "Saving…" : "Crop and use"}</button>
        </div>
      </div>
    </Sheet>
  );
}
