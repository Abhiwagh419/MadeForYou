import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useSession } from "../lib/auth";
import { isRemote } from "../lib/config";
import { download, rsvpCsv, type RsvpRow } from "../lib/csv";
import { useRoute } from "../lib/router";
import { formatWhen, waLink } from "../lib/util";
import { useStore } from "../state/store";
import { Button } from "../ui/Button";
import { Segmented, toast } from "../ui/Controls";
import { Icon } from "../ui/Icon";
import { NotFound, Shell } from "../ui/Shell";

interface Sub {
  id: string; blockId: string; kind: "wish" | "reply" | "rsvp"; status: "pending" | "approved" | "rejected";
  source: "page" | "contributor"; read: boolean; createdAt: string; payload: Record<string, any>;
}

export function Inbox() {
  const { id = "" } = useRoute().params;
  const page = useStore((s) => s.pages[id]);
  const session = useSession();
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"wish" | "reply" | "rsvp">("wish");
  const [invite, setInvite] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setSubs((await api<{ submissions: Sub[] }>(`/me/inbox?page=${id}`)).submissions);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    if (isRemote() && session.userId) void load();
  }, [load, session.userId]);

  const patch = async (s: Sub, body: { status?: Sub["status"]; read?: boolean }) => {
    setSubs((all) => all?.map((x) => (x.id === s.id ? { ...x, ...(body.status ? { status: body.status } : {}), ...(body.read !== undefined ? { read: body.read } : {}) } : x)) ?? null);
    try { await api(`/submissions/${s.id}`, { method: "PATCH", json: body }); } catch (e) { toast((e as Error).message); void load(); }
  };
  const remove = async (s: Sub) => {
    setSubs((all) => all?.filter((x) => x.id !== s.id) ?? null);
    try { await api(`/submissions/${s.id}`, { method: "DELETE" }); } catch (e) { toast((e as Error).message); void load(); }
  };

  const hasWall = !!page?.content.blocks.some((b) => b.type === "wishes");
  const getInvite = async () => {
    try {
      const { path } = await api<{ path: string }>(`/pages/${id}/contributor-link`, { method: "POST" });
      setInvite(`${window.location.origin}${path}`);
    } catch (e) { toast((e as Error).message); }
  };
  const resetInvite = async () => {
    if (!confirm("Every invite link you have sent will stop working. Continue?")) return;
    try { await api(`/pages/${id}/contributor-link/reset`, { method: "POST" }); setInvite(""); toast("Old invite links switched off"); } catch (e) { toast((e as Error).message); }
  };

  const wishes = useMemo(() => (subs ?? []).filter((s) => s.kind === "wish"), [subs]);
  const replies = useMemo(() => (subs ?? []).filter((s) => s.kind === "reply"), [subs]);
  const rsvps = useMemo(() => (subs ?? []).filter((s) => s.kind === "rsvp"), [subs]);
  const count = (r: string) => rsvps.filter((s) => s.payload.response === r).length;
  const guests = rsvps.reduce((n, s) => n + (Number(s.payload.guests) || 0), 0);
  const pending = wishes.filter((w) => w.status === "pending").length;
  const unread = replies.filter((r) => !r.read).length;

  if (!page) return <NotFound />;
  return (
    <Shell active="me">
      <div className="wrap inbox">
        <a className="back" href="#/me">← My pages</a>
        <h1>Messages</h1>
        <p className="muted">{page.title}</p>

        {!isRemote() ? (
          <div className="note-box"><Icon name="globe" size={16} /><span>Guests can send messages once your page is online. This copy of the site runs on this device only.</span></div>
        ) : !session.userId ? (
          <div className="note-box"><span>Sign in to see your messages.</span><Button size="sm" onClick={session.signIn}>Sign in</Button></div>
        ) : (
          <>
            {hasWall && (
              <section className="pcard">
                <h2>Invite friends to add a wish</h2>
                <p className="field-hint">Send this link to friends and family. They can add a wish without seeing your page, so a surprise stays a surprise. You approve every wish before it shows.</p>
                {page.status !== "published" ? (
                  <p className="field-note">Publish the page first, then come back for the link.</p>
                ) : invite ? (
                  <>
                    <div className="linkbox"><Icon name="link" size={18} /><input readOnly value={invite} aria-label="Invite link" onFocus={(e) => e.target.select()} />
                      <Button size="sm" icon="copy" onClick={async () => { try { await navigator.clipboard.writeText(invite); toast("Invite link copied"); } catch { toast("Press and hold the link to copy it"); } }}>Copy</Button></div>
                    <div className="share-actions">
                      <Button icon="whatsapp" href={waLink(`Add a wish for ${page.title}: ${invite}`)} target="_blank" rel="noopener noreferrer">Send on WhatsApp</Button>
                      <Button variant="ghost" size="sm" onClick={resetInvite}>Switch off old links</Button>
                    </div>
                  </>
                ) : (
                  <div><Button icon="link" onClick={getInvite}>Get the invite link</Button></div>
                )}
              </section>
            )}

            <div className="head-row">
              <Segmented value={tab} onChange={setTab} label="Kind of message"
                options={[{ value: "wish", label: `Wishes${pending ? ` (${pending} new)` : ""}` }, { value: "reply", label: `Replies${unread ? ` (${unread} new)` : ""}` }, { value: "rsvp", label: `RSVPs (${rsvps.length})` }]} />
              <Button size="sm" variant="ghost" icon="play" onClick={load}>Refresh</Button>
            </div>
            {error && <p className="field-error">{error}</p>}
            {subs === null && !error && <p className="muted">Loading…</p>}

            {tab === "wish" && (wishes.length === 0 ? <p className="empty-line">No wishes yet.</p> : (
              <ul className="msg-list">
                {wishes.map((w) => (
                  <li key={w.id} className={`msg ${w.status}`}>
                    <p>{w.payload.message}</p>
                    <small>{w.payload.name} · {formatWhen(w.createdAt)}{w.source === "contributor" ? " · via invite link" : ""}</small>
                    <div className="msg-actions">
                      {w.status !== "approved" && <Button size="sm" icon="check" onClick={() => patch(w, { status: "approved" })}>Show on the wall</Button>}
                      {w.status === "approved" && <Button size="sm" variant="secondary" icon="eyeoff" onClick={() => patch(w, { status: "pending" })}>Hide</Button>}
                      {w.status === "pending" && <Button size="sm" variant="ghost" onClick={() => patch(w, { status: "rejected" })}>Reject</Button>}
                      <Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => remove(w)} />
                      <span className={`badge ${w.status === "approved" ? "badge-green" : w.status === "pending" ? "badge-amber" : ""}`}>{w.status === "approved" ? "On the wall" : w.status === "pending" ? "Waiting for you" : "Rejected"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

            {tab === "reply" && (replies.length === 0 ? <p className="empty-line">No replies yet.</p> : (
              <>
                {unread > 0 && <Button size="sm" variant="secondary" onClick={() => replies.filter((r) => !r.read).forEach((r) => patch(r, { read: true }))}>Mark all as read</Button>}
                <ul className="msg-list">
                  {replies.map((r) => (
                    <li key={r.id} className={`msg ${r.read ? "" : "unread"}`}>
                      <p>{r.payload.message}</p>
                      <small>{r.payload.name || "Someone"} · {formatWhen(r.createdAt)}</small>
                      <div className="msg-actions">
                        <Button size="sm" variant="ghost" onClick={() => patch(r, { read: !r.read })}>{r.read ? "Mark as new" : "Mark as read"}</Button>
                        <Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => remove(r)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ))}

            {tab === "rsvp" && (rsvps.length === 0 ? <p className="empty-line">No answers yet.</p> : (
              <>
                <div className="rsvp-stats">
                  <div><b>{count("yes")}</b><span>coming</span></div>
                  <div><b>{count("maybe")}</b><span>maybe</span></div>
                  <div><b>{count("no")}</b><span>cannot come</span></div>
                  <div><b>{guests}</b><span>guests in total</span></div>
                </div>
                <div className="head-row">
                  <span className="muted">{rsvps.length} answer{rsvps.length === 1 ? "" : "s"}</span>
                  <Button size="sm" variant="secondary" icon="download" onClick={() => download("rsvps.csv", rsvpCsv(rsvps.map((s): RsvpRow => ({ name: s.payload.name, response: s.payload.response, guests: s.payload.guests, note: s.payload.note, createdAt: s.createdAt }))))}>Download for Excel</Button>
                </div>
                <ul className="msg-list">
                  {rsvps.map((s) => (
                    <li key={s.id} className="msg">
                      <p><b>{s.payload.name}</b> · {s.payload.response === "yes" ? `coming, ${s.payload.guests} ${s.payload.guests === 1 ? "person" : "people"}` : s.payload.response === "maybe" ? `maybe, ${s.payload.guests}` : "cannot come"}</p>
                      {s.payload.note && <p className="muted">“{s.payload.note}”</p>}
                      <small>{formatWhen(s.createdAt)}</small>
                      <div className="msg-actions"><Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => remove(s)} /></div>
                    </li>
                  ))}
                </ul>
              </>
            ))}
          </>
        )}
      </div>
    </Shell>
  );
}
