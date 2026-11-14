import { useState } from "react";
import { BRAND } from "@madeforyou/ui";
import { wipeLocalData } from "../lib/account";
import { api, ApiError } from "../lib/api";
import { useSession } from "../lib/auth";
import { isRemote } from "../lib/config";
import { useStore } from "../state/store";
import { Button } from "../ui/Button";
import { Sheet, toast } from "../ui/Controls";
import { Shell } from "../ui/Shell";

/** Your account, and the way to delete all of it. */
export function Account() {
  const session = useSession();
  const pageCount = useStore((s) => Object.keys(s.pages).length);
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signedIn = isRemote() && !!session.userId;

  const goodbye = (message: string) => {
    toast(message);
    window.location.hash = "#/";
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/me", { method: "DELETE", json: { confirm: word } });
      await wipeLocalData();
      session.signOut();
      setOpen(false);
      goodbye("Your account and everything in it has been deleted");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Nothing was deleted. Please try again.");
    }
    setBusy(false);
  };

  const clearDevice = async () => {
    setBusy(true);
    await wipeLocalData();
    setBusy(false);
    setOpen(false);
    goodbye("Everything on this device has been cleared");
  };

  return (
    <Shell>
      <div className="wrap account">
        <h1>Your account</h1>
        {signedIn ? (
          <p className="field-hint">Signed in as <b>{session.label || "you"}</b>.</p>
        ) : (
          <p className="field-hint">{isRemote() ? "You are not signed in. Pages you make are kept on this device until you sign in." : "Your pages are kept on this device only."}</p>
        )}

        <section className="pcard">
          <h2>What we keep</h2>
          <p>{signedIn
            ? "Your pages, photos, voice notes, the messages visitors sent you and the emails you scheduled are stored for you so that your pages can open for the people you share them with."
            : `${pageCount} page${pageCount === 1 ? "" : "s"} on this device. Nothing is stored for you on our servers.`}</p>
          <p className="field-hint">Read the <a href="#/privacy">Privacy</a> page for the full list. To get a copy of your data or have something corrected, write to <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.</p>
        </section>

        <section className="pcard danger-zone">
          <h2>{signedIn ? "Delete my account and all my data" : "Clear everything on this device"}</h2>
          <p>{signedIn
            ? "This removes your account, every page and photo, all visitor messages and scheduled emails, and your templates. Links to your pages stop working straight away. It cannot be undone."
            : "This removes the pages and photos kept in this browser. It cannot be undone."}</p>
          <div><Button variant="danger" icon="trash" onClick={() => { setWord(""); setError(""); setOpen(true); }}>{signedIn ? "Delete my account" : "Clear this device"}</Button></div>
        </section>
      </div>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={signedIn ? "Delete your account?" : "Clear this device?"}>
        {signedIn ? (
          <form className="report" onSubmit={(e) => { e.preventDefault(); if (word.trim().toUpperCase() === "DELETE" && !busy) void deleteAccount(); }}>
            <p>Everything you made will be gone for good, for you and for everyone you shared it with. To go ahead, type <b>DELETE</b> below.</p>
            <input className="in" value={word} autoComplete="off" autoCapitalize="characters" aria-label="Type DELETE to confirm" placeholder="DELETE" onChange={(e) => setWord(e.target.value)} />
            {error && <p className="field-error" role="alert">{error}</p>}
            <div className="report-actions">
              <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Keep my account</Button>
              <Button type="submit" variant="danger" disabled={word.trim().toUpperCase() !== "DELETE" || busy}>{busy ? "Deleting…" : "Delete everything"}</Button>
            </div>
          </form>
        ) : (
          <div className="report">
            <p>The pages and photos in this browser will be removed for good.</p>
            <div className="report-actions">
              <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" disabled={busy} onClick={clearDevice}>{busy ? "Clearing…" : "Clear everything"}</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Shell>
  );
}
