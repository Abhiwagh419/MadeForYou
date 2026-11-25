import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@madeforyou/ui";
import { apiRaw } from "../lib/api";
import { useSession } from "../lib/auth";
import { authMode, clerkKey, isRemote } from "../lib/config";
import { syncAll, type SyncReport } from "../lib/sync";
import { getState } from "../state/store";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Shell } from "../ui/Shell";

interface Row {
  label: string;
  state: "ok" | "bad" | "info" | "wait";
  value: string;
  hint?: string;
}

export function Status() {
  const session = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    const out: Row[] = [];
    const local = Object.values(getState().pages);
    out.push({
      label: "This copy of the site",
      state: isRemote() ? "ok" : "bad",
      value: isRemote() ? "Online: uses the server" : "Offline: pages stay on this device",
      hint: isRemote() ? undefined : "It was built without VITE_REMOTE=1. Check .env.production and deploy again.",
    });
    out.push({
      label: "Sign-in",
      state: authMode() === "clerk" ? "ok" : authMode() === "dev" ? "info" : "info",
      value: authMode() === "clerk" ? `Clerk (${clerkKey().slice(0, 11)}…)` : authMode() === "dev" ? "Test login (no Clerk key in this build)" : "Not used",
    });
    out.push({ label: "You", state: session.userId ? "ok" : "info", value: session.userId ? `Signed in${session.label ? ` as ${session.label}` : ""}` : "Not signed in" });
    out.push({ label: "Pages on this device", state: "info", value: `${local.length} (${local.filter((p) => p.status === "published").length} published)` });

    if (isRemote()) {
      try {
        const h = await apiRaw("/health", { auth: false });
        out.push({ label: "Server", state: h.status === 200 ? "ok" : "bad", value: h.status === 200 ? "Reachable" : `Answered ${h.status}` });
      } catch {
        out.push({ label: "Server", state: "bad", value: "Not reachable", hint: "Check your connection." });
      }
      if (session.userId) {
        const d = await apiRaw<{ ok: boolean; problem: string | null; configuredIssuer: string | null; tokenIssuer: string | null; secretOk?: boolean }>("/diag");
        out.push({
          label: "Server accepts your login",
          state: d.data?.ok ? "ok" : "bad",
          value: d.data?.ok ? "Yes" : "No",
          hint: d.data?.ok ? undefined : d.data?.problem ?? undefined,
        });
        if (d.data?.secretOk === false) {
          out.push({ label: "Signing secret", state: "bad", value: "Too short", hint: "SESSION_SECRET should be at least 24 random characters. A short one makes password pages and private photos easier to break. Set a new long one and deploy again." });
        }
        if (d.data?.configuredIssuer || d.data?.tokenIssuer) {
          out.push({ label: "Clerk address on the server", state: "info", value: d.data.configuredIssuer ?? "not set" });
          out.push({ label: "Clerk address in your login", state: "info", value: d.data.tokenIssuer ?? "unknown" });
        }
        const mine = await apiRaw<{ pages: { id: string; status: string }[] }>("/me/pages");
        out.push({
          label: "Pages in your account",
          state: mine.status === 200 ? "ok" : "bad",
          value: mine.status === 200 ? `${mine.data.pages.length} (${mine.data.pages.filter((p) => p.status === "published").length} published)` : `Could not read (${mine.status})`,
        });
      }
    }
    setRows(out);
  }, [session.userId, session.label]);

  useEffect(() => {
    check();
  }, [check]);

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      setReport(await syncAll());
      await check();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Shell>
      <div className="wrap status">
        <h1>Connection status</h1>
        <p className="lede-sm">What {BRAND.name} on this device is connected to. If something is not working, a screenshot of this page shows exactly why.</p>
        <ul className="status-list">
          {rows.map((r) => (
            <li key={r.label} className={r.state}>
              <span className="status-dot" aria-hidden="true">{r.state === "ok" ? <Icon name="check" size={14} /> : r.state === "bad" ? <Icon name="x" size={14} /> : null}</span>
              <div>
                <strong>{r.label}</strong>
                <span>{r.value}</span>
                {r.hint && <small>{r.hint}</small>}
              </div>
            </li>
          ))}
        </ul>
        <div className="cta-row">
          <Button variant="secondary" icon="play" onClick={check}>Check again</Button>
          {isRemote() && (session.userId
            ? <Button icon="share" disabled={busy} onClick={sync}>{busy ? "Syncing…" : "Sync all my pages now"}</Button>
            : <Button onClick={session.signIn}>Sign in</Button>)}
        </div>
        {error && <p className="field-error">{error}</p>}
        {report && (
          <div className="note-box">
            <span>
              Saved {report.pushed} page{report.pushed === 1 ? "" : "s"} to your account
              {report.republished ? `, published again: ${report.republished}` : ""}
              {report.pulled ? `, brought here: ${report.pulled}` : ""}.
              {report.needsRepublish.length ? ` Publish these again (they have a password): ${report.needsRepublish.join(", ")}.` : ""}
              {report.failed.length ? ` Could not save: ${report.failed.map((f) => `${f.title} (${f.reason})`).join("; ")}.` : ""}
            </span>
          </div>
        )}
      </div>
    </Shell>
  );
}
