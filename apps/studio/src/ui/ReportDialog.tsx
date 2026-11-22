import { useState } from "react";
import { BRAND } from "@madeforyou/ui";
import { apiRaw } from "../lib/api";
import { checkHuman } from "../lib/turnstile";
import { Button } from "./Button";
import { Sheet } from "./Controls";

export const REPORT_REASONS = [
  { value: "abuse", label: "It is hurtful, threatening or unlawful" },
  { value: "private", label: "It shows me or my private details without my consent" },
  { value: "copyright", label: "It uses my photo, music or writing without permission" },
  { value: "spam", label: "It is spam or a scam" },
  { value: "other", label: "Something else" },
] as const;

/** "Report this page": a short form that goes to the person who runs the site. */
export function ReportDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // a field real people never see; bots fill it
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [error, setError] = useState("");

  const send = async () => {
    setState("sending");
    setError("");
    const human = await checkHuman();
    if (!human.ok) { setError(human.error); setState("form"); return; }
    const r = await apiRaw(`/p/${slug}/report`, { json: { reason, details, contact, website, ...(human.token ? { turnstile: human.token } : {}) }, auth: false }).catch(() => null);
    if (r && r.status === 200) setState("done");
    else {
      setError(r?.data?.error ?? "We could not send it. Please try again.");
      setState("form");
    }
  };

  return (
    <Sheet open onClose={onClose} title="Report this page">
      {state === "done" ? (
        <div className="report">
          <p>Thank you. We have your report and will look at it. If you wrote an email or phone number we may contact you.</p>
          <div><Button onClick={onClose}>Close</Button></div>
        </div>
      ) : (
        <form className="report" onSubmit={(e) => { e.preventDefault(); if (reason && state === "form") void send(); }}>
          <p className="field-hint">What is wrong with this page?</p>
          <div className="report-reasons" role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className={reason === r.value ? "on" : ""}>
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          <label className="field">Tell us a little more{reason === "other" ? "" : " (optional)"}
            <textarea className="in" rows={3} maxLength={600} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          <label className="field">How can we reach you? (optional)
            <input className="in" maxLength={120} value={contact} placeholder="Email or phone" onChange={(e) => setContact(e.target.value)} />
          </label>
          <div className="mfy-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <p className="field-hint">Reports go to {BRAND.operator}, who runs {BRAND.name}. Read how we handle them in the <a href="/#/privacy">Privacy</a> page. Urgent or serious? Write to <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.</p>
          <div className="report-actions">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!reason || (reason === "other" && !details.trim()) || state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
