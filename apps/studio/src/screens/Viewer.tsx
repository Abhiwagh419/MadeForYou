import { useEffect, useState, type CSSProperties } from "react";
import { PageRenderer } from "@madeforyou/renderer";
import { BRAND, themeToCssVars } from "@madeforyou/ui";
import { useAssets } from "../lib/assets";
import { useRoute } from "../lib/router";
import { sha256 } from "../lib/util";
import { useStore, type PageRecord } from "../state/store";
import { Button } from "../ui/Button";
import { Mark } from "../ui/Logo";

function Centered({ page, children }: { page?: PageRecord; children: React.ReactNode }) {
  const style = themeToCssVars(page?.content.settings.theme.preset ?? "rose-garden") as CSSProperties;
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

export function Viewer() {
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
