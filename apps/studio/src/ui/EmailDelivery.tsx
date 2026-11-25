import { useCallback, useEffect, useState } from "react";
import { api, ApiError, apiRaw } from "../lib/api";
import { isRemote } from "../lib/config";
import { formatWhen } from "../lib/util";
import { Button } from "./Button";
import { Segmented, toast } from "./Controls";

interface Delivery { id: string; toEmail: string; toName: string; fromName: string; note: string; sendAt: string; status: "scheduled" | "sending" | "sent" | "failed" | "cancelled"; error?: string; sentAt?: string }

const pad = (n: number) => String(n).padStart(2, "0");
const tomorrowMorning = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const statusLine = (d: Delivery) =>
  d.status === "scheduled" ? `Will be sent ${formatWhen(d.sendAt)}${d.error ? ` (${d.error})` : ""}`
    : d.status === "sending" ? "Sending now"
      : d.status === "sent" ? `Sent ${formatWhen(d.sentAt ?? d.sendAt)}`
        : d.status === "cancelled" ? "Cancelled"
          : `Could not send: ${d.error ?? "unknown reason"}`;

export function EmailDelivery({ pageId, defaultTo, defaultFrom }: { pageId: string; defaultTo: string; defaultFrom: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [list, setList] = useState<Delivery[]>([]);
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState(defaultTo);
  const [fromName, setFromName] = useState(defaultFrom);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"now" | "later">("later");
  const [when, setWhen] = useState(tomorrowMorning());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setList((await api<{ deliveries: Delivery[] }>(`/pages/${pageId}/deliveries`)).deliveries);
    } catch {}
  }, [pageId]);

  useEffect(() => {
    if (!isRemote()) return;
    void apiRaw<{ email: boolean }>("/mail/status", { auth: false }).then((r) => setOn(!!r.data?.email));
    void load();
  }, [load]);

  const whenInvalid = mode === "later" && (!when || new Date(when).getTime() < Date.now() - 60_000);
  const ready = toEmail.includes("@") && fromName.trim() && !whenInvalid && !busy;

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ delivery: Delivery }>(`/pages/${pageId}/deliveries`, {
        json: { toEmail, toName, fromName, note, sendAt: mode === "later" ? new Date(when).toISOString() : null },
      });
      toast(r.delivery.status === "sent" ? "Sent" : r.delivery.status === "failed" ? "It could not be sent" : `Scheduled for ${formatWhen(r.delivery.sendAt)}`);
      setToEmail("");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  const remove = async (d: Delivery) => {
    try {
      await api(`/deliveries/${d.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not do that");
    }
  };

  if (!isRemote()) {
    return (
      <div className="pcard">
        <h2>Send it by email</h2>
        <p className="field-hint">Emailing a page to someone on a date works on the live website. This is a test copy on your own computer, so it is switched off here.</p>
      </div>
    );
  }

  return (
    <div className="pcard">
      <h2>Send it by email</h2>
      <p className="field-hint">We email them the link, now or on the day you choose, such as the morning of their birthday.</p>
      {on === false && <p className="note-box">Email is not switched on yet for this website. Once the sender is set up it will work here.</p>}
      {on !== false && (
        <>
          <div className="form-grid">
            <label className="field">Their email
              <input className="in" type="email" inputMode="email" autoComplete="off" value={toEmail} maxLength={254} placeholder="name@example.com" onChange={(e) => setToEmail(e.target.value)} />
            </label>
            <label className="field">Their name (optional)
              <input className="in" value={toName} maxLength={60} onChange={(e) => setToName(e.target.value)} />
            </label>
            <label className="field">From (your name)
              <input className="in" value={fromName} maxLength={60} placeholder="Your name" onChange={(e) => setFromName(e.target.value)} />
            </label>
            <label className="field">A note with it (optional)
              <textarea className="in" rows={2} value={note} maxLength={300} placeholder="Open it when you are ready." onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <Segmented<"now" | "later"> label="When" value={mode} onChange={setMode} options={[{ value: "later", label: "On a date" }, { value: "now", label: "Right now" }]} />
          {mode === "later" && (
            <>
              <input className="in" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When to send it" />
              {whenInvalid && <p className="field-error">Pick a time in the future</p>}
            </>
          )}
          <p className="field-hint">Only this person gets it, once. They can tell us to stop. Please only email people who would like to hear from you.</p>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div><Button icon="mail" disabled={!ready} onClick={send}>{busy ? "Working…" : mode === "now" ? "Send it now" : "Schedule it"}</Button></div>
        </>
      )}
      {list.length > 0 && (
        <ul className="delivery-list">
          {list.map((d) => (
            <li key={d.id} className={`delivery ${d.status}`}>
              <div>
                <b>{d.toName ? `${d.toName} · ` : ""}{d.toEmail}</b>
                <small>{statusLine(d)}</small>
              </div>
              <Button size="sm" variant="ghost" icon="trash" aria-label={d.status === "scheduled" ? "Cancel" : "Remove from the list"} disabled={d.status === "sending"} onClick={() => remove(d)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
