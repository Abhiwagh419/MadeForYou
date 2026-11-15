import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { PageRenderer, type Host } from "@madeforyou/renderer";
import { BRAND, themeToCssVars } from "@madeforyou/ui";
import type { Content } from "@madeforyou/schema";
import { apiRaw } from "../lib/api";
import { useAssets } from "../lib/assets";
import { isRemote } from "../lib/config";
import { useRoute } from "../lib/router";
import { checkHuman } from "../lib/turnstile";
import { sha256 } from "../lib/util";
import { useStore, type PageRecord } from "../state/store";
import { Button } from "../ui/Button";
import { Mark } from "../ui/Logo";
import { ReportDialog } from "../ui/ReportDialog";

function Centered({ page, preset, children }: { page?: PageRecord; preset?: string; children: React.ReactNode }) {
  const style = themeToCssVars(preset ?? page?.content.settings.theme.preset ?? "rose-garden") as CSSProperties;
  return (
    <div className="gate" style={style}>
      <div className="gate-card">{children}</div>
      <p className="gate-foot"><Mark size={18} />{BRAND.badgeText}</p>
    </div>
  );
}

function Countdown({ to, onDone }: { to: number; onDone: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, to - now);
  useEffect(() => {
    if (ms === 0) onDone();
  }, [ms, onDone]);
  const s = Math.floor(ms / 1000);
  const parts: [number, string][] = [[Math.floor(s / 86400), "days"], [Math.floor((s % 86400) / 3600), "hours"], [Math.floor((s % 3600) / 60), "minutes"], [s % 60, "seconds"]];
  return (
    <dl className="gate-count">
      {parts.map(([v, l]) => <div key={l}><dd>{String(v).padStart(2, "0")}</dd><dt>{l}</dt></div>)}
    </dl>
  );
}

function Open({ page }: { page: PageRecord }) {
  const resolve = useAssets(page.content);
  useEffect(() => {
    document.title = page.title;
  }, [page.title]);
  return <PageRenderer content={page.content} resolveAsset={resolve} />;
}

function LocalViewer() {
  const { slug = "" } = useRoute().params;
  const page = useStore((s) => Object.values(s.pages).find((p) => p.slug === slug && p.status === "published"));
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwOk, setPwOk] = useState(false);
  const [wrong, setWrong] = useState(false);

  if (!page) {
    return (
      <Centered>
        <h1>This page is not here</h1>
        <p>The link may be mistyped, or the page may have been taken down.</p>
        <Button href="#/" variant="secondary">Make your own</Button>
      </Centered>
    );
  }
  const { access } = page;
  if (access.expiresAt && new Date(access.expiresAt).getTime() < Date.now()) {
    return <Centered page={page}><h1>This page has ended</h1><p>Its time is up, but the person who made it can always share it again.</p></Centered>;
  }
  // Locked content is never rendered before its time. (Enforced on the server once live.)
  const lockAt = access.unlockAt ? new Date(access.unlockAt).getTime() : 0;
  if (lockAt > Date.now() && !unlocked) {
    return (
      <Centered page={page}>
        <p className="gate-eyebrow">Something is waiting for you</p>
        <h1>Not just yet</h1>
        <Countdown to={lockAt} onDone={() => setUnlocked(true)} />
        <p>It opens on {new Date(lockAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}. Come back then.</p>
      </Centered>
    );
  }
  if (access.passwordHash && !pwOk) {
    return (
      <Centered page={page}>
        <h1>Enter the password</h1>
        <p>The person who sent you this link will have told you.</p>
        <form onSubmit={async (e) => { e.preventDefault(); const ok = (await sha256(pw)) === access.passwordHash; setPwOk(ok); setWrong(!ok); }}>
          <input className="in in-lg" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }} aria-label="Password" autoFocus />
          {wrong && <p className="field-error">That is not it. Try again.</p>}
          <Button type="submit" size="lg">Open</Button>
        </form>
      </Centered>
    );
  }
  return (
    <>
      {access.visibility === "private" && <div className="ribbon">Only you can see this page</div>}
      <Open page={page} />
    </>
  );
}

/* ---------- online: the server decides what this visitor may receive ---------- */

type Remote =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "ended" }
  | { state: "error"; message: string }
  | { state: "locked"; unlockAt: string; theme: string }
  | { state: "password"; theme: string; error?: string }
  | { state: "open"; title: string; content: Content; assetToken: string; owner: boolean; visibility: string; canRemind?: boolean; wishes?: Record<string, { id: string; name: string; message: string }[]> };

function RemoteOpen({ v, slug }: { v: Extract<Remote, { state: "open" }>; slug: string }) {
  const resolve = useAssets(v.content, v.assetToken);
  const [reporting, setReporting] = useState(false);
  // Guests' messages go to the server with the token this visitor earned by getting past the lock and password.
  const host = useMemo<Host>(() => ({
    wishes: v.wishes ?? {},
    canRemind: !!v.canRemind,
    submit: async (blockId, kind, payload, extra) => {
      const human = await checkHuman();
      if (!human.ok) return { ok: false, error: human.error };
      const r = await apiRaw(`/p/${slug}/submit`, { json: { token: v.assetToken, blockId, kind, payload, ...extra, ...(human.token ? { turnstile: human.token } : {}) } });
      return r.status === 200 ? { ok: true, status: r.data?.status } : { ok: false, error: r.data?.error ?? "Something went wrong. Please try again." };
    },
  }), [v.wishes, v.canRemind, v.assetToken, slug]);
  useEffect(() => {
    document.title = v.title;
  }, [v.title]);
  return (
    <>
      {v.owner && v.visibility === "private" && <div className="ribbon">Only you can see this page</div>}
      <PageRenderer content={v.content} resolveAsset={resolve} host={host} />
      {!v.owner && (
        <footer className="viewer-foot">
          <button type="button" onClick={() => setReporting(true)}>Report this page</button>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
        </footer>
      )}
      {reporting && <ReportDialog slug={slug} onClose={() => setReporting(false)} />}
    </>
  );
}

function RemoteViewer() {
  const { slug = "" } = useRoute().params;
  const [v, setV] = useState<Remote>({ state: "loading" });
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const accept = (status: number, data: any) =>
    setV(status === 200 || status === 404 || status === 410 || status === 401 ? (data as Remote) : { state: "error", message: data?.error ?? "Something went wrong. Please try again." });

  const load = useCallback(async () => {
    try {
      const r = await apiRaw(`/p/${slug}`);
      accept(r.status, r.data);
    } catch {
      setV({ state: "error", message: "We could not reach the server. Check your connection." });
    }
  }, [slug]);

  useEffect(() => {
    setV({ state: "loading" });
    load();
  }, [load]);

  if (v.state === "loading") return <Centered><p>Opening…</p></Centered>;
  if (v.state === "missing") {
    return (
      <Centered>
        <h1>This page is not here</h1>
        <p>The link may be mistyped, or the page may have been taken down.</p>
        <Button href="/" variant="secondary">Make your own</Button>
      </Centered>
    );
  }
  if (v.state === "ended") return <Centered><h1>This page has ended</h1><p>Its time is up, but the person who made it can always share it again.</p></Centered>;
  if (v.state === "error") return <Centered><h1>Hmm</h1><p>{v.message}</p><Button onClick={load}>Try again</Button></Centered>;
  if (v.state === "locked") {
    return (
      <Centered preset={v.theme}>
        <p className="gate-eyebrow">Something is waiting for you</p>
        <h1>Not just yet</h1>
        <Countdown to={Date.parse(v.unlockAt)} onDone={load} />
        <p>It opens on {new Date(v.unlockAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}. Come back then.</p>
      </Centered>
    );
  }
  if (v.state === "password") {
    return (
      <Centered preset={v.theme}>
        <h1>Enter the password</h1>
        <p>The person who sent you this link will have told you.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await apiRaw(`/p/${slug}/open`, { json: { password: pw } });
              if (r.status === 429) setV({ state: "password", theme: v.theme, error: r.data?.error });
              else accept(r.status, r.data);
            } catch {
              setV({ state: "password", theme: v.theme, error: "We could not reach the server." });
            }
            setBusy(false);
          }}
        >
          <input className="in in-lg" type="password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" autoFocus />
          {v.error && <p className="field-error">{v.error}</p>}
          <Button type="submit" size="lg" disabled={busy || !pw}>Open</Button>
        </form>
      </Centered>
    );
  }
  return <RemoteOpen v={v} slug={slug} />;
}

export function Viewer() {
  return isRemote() ? <RemoteViewer /> : <LocalViewer />;
}
