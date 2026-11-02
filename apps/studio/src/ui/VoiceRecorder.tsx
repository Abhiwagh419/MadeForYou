import { useEffect, useRef, useState } from "react";
import type { AudioRef } from "@madeforyou/schema";
import { saveAudio, useAssetUrl } from "../lib/assets";
import { Button } from "./Button";
import { Icon } from "./Icon";

const MAX_SECONDS = 60;
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

/** Record a voice note in the browser (up to a minute), or upload an audio file. */
export function VoiceRecorder({ value, onChange, large }: { value: AudioRef | null | undefined; onChange: (v: AudioRef | null) => void; large?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const url = useAssetUrl(value?.asset);
  const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const finish = async (blob: Blob, secs?: number) => {
    setState("saving");
    try {
      const ref = await saveAudio(blob);
      onChange({ asset: ref.asset, ...(secs !== undefined ? { seconds: Math.min(MAX_SECONDS, secs) } : {}) });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    setState("idle");
  };

  const start = async () => {
    setError("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(stream.current, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        const secs = Math.round((Date.now() - started.current) / 1000);
        void finish(new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" }), secs);
      };
      started.current = Date.now();
      r.start();
      recorder.current = r;
      setState("recording");
      setSeconds(0);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setError("We could not use the microphone. Allow it in your browser, or upload a recording instead.");
    }
  };
  const stop = () => {
    clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  if (value) {
    return (
      <div className="voice-set">
        {url ? <audio controls src={url} preload="metadata" /> : <p className="field-note">Voice note saved{value.seconds ? ` (${mmss(Math.round(value.seconds))})` : ""}</p>}
        <div className="voice-actions">
          <Button size="sm" variant="secondary" icon="music" onClick={() => onChange(null)}>Record again</Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => onChange(null)}>Remove</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={`voice ${large ? "voice-lg" : ""}`}>
      {state === "recording" ? (
        <>
          <div className="rec-meter" aria-live="polite"><i /><b>{mmss(seconds)}</b><span>of 1:00</span></div>
          <Button size={large ? "lg" : "md"} variant="danger" icon="x" onClick={stop}>Stop recording</Button>
        </>
      ) : (
        <>
          {canRecord && <Button size={large ? "lg" : "md"} icon="music" disabled={state === "saving"} onClick={start}>{state === "saving" ? "Saving…" : "Record a voice note"}</Button>}
          <label className="voice-upload">
            <Icon name="download" size={16} />
            <span>{canRecord ? "or upload an audio file" : "Upload an audio file"}</span>
            <input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void finish(f); e.target.value = ""; }} />
          </label>
        </>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
