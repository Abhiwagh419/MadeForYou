import { useCallback, useEffect, useState } from "react";
import { apiRaw } from "../lib/api";
import { formatWhen } from "../lib/util";
import { Button } from "../ui/Button";
import { toast } from "../ui/Controls";
import { REPORT_REASONS } from "../ui/ReportDialog";
import { Shell } from "../ui/Shell";

interface Report {
  id: string; page_id: string; slug: string; reason: string; details: string | null; contact: string | null;
  status: "open" | "removed" | "dismissed"; created_at: string; title: string; owner_id: string; page_status: string;
  taken_down_at: string | null; open_for_page: number;
}
interface Usage { users: number; pages: number; published: number; photos: number; photoMegabytes: number; storage: string }

const KEY = "mfy:admin-token";
const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;

/** For the person who runs the site: reports to look at, and what to do about them. Needs the ADMIN_TOKEN secret. */
export function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(KEY) ?? "");
  const [draft, setDraft] = useState("");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [all, setAll] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const h = { "x-admin-token": token };
    const r = await apiRaw<{ reports: Report[] }>(`/admin/reports${all ? "?status=all" : ""}`, { headers: h, auth: false });
    if (r.status === 403) {
      sessionStorage.removeItem(KEY);
      setToken("");
      setError("That token was not accepted. Check the ADMIN_TOKEN secret.");
      return;
    }
    setError("");
    setReports(r.data?.reports ?? []);
    const u = await apiRaw<Usage>("/admin/usage", { headers: h, auth: false });
    if (u.status === 200) setUsage(u.data);
  }, [token, all]);
  useEffect(() => { void load(); }, [load]);

  const act = async (r: Report, action: "remove" | "dismiss") => {
    if (action === "remove" && !window.confirm(`Take down “${r.title}”? Its owner will not be able to publish it again until you restore it.`)) return;
    const res = await apiRaw(`/admin/reports/${r.id}/${action}`, { method: "POST", headers: { "x-admin-token": token }, auth: false });
    toast(res.status === 200 ? (action === "remove" ? "Page taken down" : "Report dismissed") : "That did not work");
    await load();
  };
  const restore = async (r: Report) => {
    const res = await apiRaw(`/admin/pages/${r.page_id}/restore`, { method: "POST", headers: { "x-admin-token": token }, auth: false });
    toast(res.status === 200 ? "Restored. The owner can publish it again." : "That did not work");
    await load();
  };

  if (!token) {
    return (
      <Shell>
        <div className="wrap account">
          <h1>Review</h1>
          <form className="pcard" onSubmit={(e) => { e.preventDefault(); sessionStorage.setItem(KEY, draft.trim()); setToken(draft.trim()); setDraft(""); }}>
            <h2>Admin token</h2>
            <p className="field-hint">Only for the person who runs the site. It is the ADMIN_TOKEN secret and is kept in this tab only.</p>
            <input className="in" type="password" autoComplete="off" value={draft} aria-label="Admin token" onChange={(e) => setDraft(e.target.value)} />
            {error && <p className="field-error" role="alert">{error}</p>}
            <div><Button type="submit" disabled={!draft.trim()}>Open</Button></div>
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="wrap account">
        <h1>Review</h1>
        {usage && <p className="field-hint">{usage.users} {usage.users === 1 ? "person" : "people"} · {usage.published} live pages · {usage.photos} photos ({usage.photoMegabytes} MB) · storage: {usage.storage}</p>}
        <div className="head-row">
          <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show reports already handled</label>
          <Button size="sm" variant="ghost" onClick={() => { sessionStorage.removeItem(KEY); setToken(""); setReports(null); }}>Close</Button>
        </div>
        {reports === null ? <p className="field-hint">Loading…</p> : reports.length === 0 ? <p className="empty-line">Nothing waiting. No open reports.</p> : (
          <ul className="admin-list">
            {reports.map((r) => (
              <li key={r.id} className={`pcard report-item ${r.status}`}>
                <div className="head-row">
                  <b>{r.title}</b>
                  <span className="muted">{formatWhen(r.created_at)}</span>
                </div>
                <p><b>{reasonLabel(r.reason)}</b></p>
                {r.details && <p>“{r.details}”</p>}
                <p className="field-hint">
                  {r.contact ? `Reporter: ${r.contact} · ` : "No contact given · "}
                  {r.open_for_page > 1 ? `${r.open_for_page} open reports on this page · ` : ""}
                  owner {r.owner_id}
                </p>
                <div className="report-actions">
                  <Button size="sm" variant="secondary" icon="eye" href={`#/p/${r.slug}`} target="_blank" rel="noreferrer">Open the page</Button>
                  {r.status === "open" ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => act(r, "dismiss")}>Dismiss</Button>
                      <Button size="sm" variant="danger" icon="trash" onClick={() => act(r, "remove")}>Take the page down</Button>
                    </>
                  ) : (
                    <>
                      <span className="muted">{r.status === "removed" ? "Page taken down" : "Dismissed"}</span>
                      {r.status === "removed" && r.taken_down_at && <Button size="sm" variant="ghost" onClick={() => restore(r)}>Restore</Button>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
