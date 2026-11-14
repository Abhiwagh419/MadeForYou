import { useEffect, useMemo, useState } from "react";
import { checkPublishable, registry, type SlugStatus } from "@madeforyou/schema";
import { BRAND } from "@madeforyou/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/auth";
import { isRemote } from "../lib/config";
import { handleAuthError, publishRemote } from "../lib/sync";
import { go, useRoute } from "../lib/router";
import { SLUG_MESSAGES, formatWhen, sha256, slugStatus, slugSuggestions, slugify } from "../lib/util";
import { savePage, slugTaken, useStore } from "../state/store";
import { Button } from "../ui/Button";
import { Segmented, Switch } from "../ui/Controls";
import { Field } from "../ui/Fields";
import { Icon } from "../ui/Icon";
import { NotFound, Shell } from "../ui/Shell";
import { Thumb } from "../ui/Thumb";

const tomorrowMidnight = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00`;
};
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function Publish() {
  const { id = "" } = useRoute().params;
  const page = useStore((s) => s.pages[id]);
  if (!page) return <NotFound />;
  return <PublishInner key={id} id={id} />;
}

function PublishInner({ id }: { id: string }) {
  const page = useStore((s) => s.pages[id])!;
  const heroName = String(page.content.blocks.find((b) => b.type === "hero")?.fields.recipient ?? "");
  const [slug, setSlug] = useState(page.slug || slugify(heroName) || "");
  const [visibility, setVisibility] = useState(page.access.visibility);
  const [usePw, setUsePw] = useState(!!page.access.passwordHash);
  const [pw, setPw] = useState("");
  const [useLock, setUseLock] = useState(!!page.access.unlockAt);
  const [unlock, setUnlock] = useState(toLocalInput(page.access.unlockAt) || tomorrowMidnight());
  const [useExpiry, setUseExpiry] = useState(!!page.access.expiresAt);
  const [expiry, setExpiry] = useState(toLocalInput(page.access.expiresAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [serverStatus, setServerStatus] = useState<SlugStatus | null>(null);
  const session = useSession();
  const needSignIn = isRemote() && !session.userId;

  const check = useMemo(() => checkPublishable(page.content), [page.content]);
  const errors = check.issues.filter((i) => i.severity === "error");
  const warnings = check.issues.filter((i) => i.severity === "warning");
  const localStatus = slugStatus(slug, (s) => slugTaken(s, id));
  // Online, the server is the judge of who already has a link.
  const status: SlugStatus = localStatus !== "ok" ? localStatus : serverStatus ?? "ok";
  useEffect(() => {
    setServerStatus(null);
    if (!isRemote() || localStatus !== "ok") return;
    const t = setTimeout(() => {
      api<{ status: SlugStatus }>(`/slug/${slug}?page=${id}`, { auth: false }).then((r) => setServerStatus(r.status)).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [slug, id, localStatus]);
  const pwNeeded = usePw && !page.access.passwordHash && pw.length < 4;
  const lockInvalid = useLock && (!unlock || new Date(unlock).getTime() <= Date.now());
  const expiryInvalid = useExpiry && (!expiry || new Date(expiry).getTime() <= Date.now());
  const ready = check.canPublish && status === "ok" && !pwNeeded && !lockInvalid && !expiryInvalid && !needSignIn;

  const blockName = (bid: string) => registry[page.content.blocks.find((b) => b.id === bid)?.type ?? ""]?.label ?? "Block";

  const publish = async () => {
    setBusy(true);
    setError("");
    if (isRemote()) {
      try {
        await publishRemote(id, {
          slug, visibility,
          password: usePw ? (pw ? pw : undefined) : null,
          unlockAt: useLock ? new Date(unlock).toISOString() : null,
          expiresAt: useExpiry && expiry ? new Date(expiry).toISOString() : null,
        });
        go(`/share/${id}`);
      } catch (e) {
        setError(((await handleAuthError(e)) ? "The server did not accept your sign-in. The reason is shown at the top of the page." : (e as Error).message));
        setBusy(false);
      }
      return;
    }
    const passwordHash = usePw ? (pw ? await sha256(pw) : page.access.passwordHash) : undefined;
    savePage(id, {
      slug, status: "published", publishedAt: page.publishedAt ?? new Date().toISOString(),
      access: {
        visibility, passwordHash,
        unlockAt: useLock ? new Date(unlock).toISOString() : null,
        expiresAt: useExpiry && expiry ? new Date(expiry).toISOString() : null,
      },
    });
    go(`/share/${id}`);
  };

  return (
    <Shell>
      <div className="wrap publish">
        <div className="publish-main">
          <a className="back" href={`#/edit/${id}`}>← Back to editor</a>
          <h1>Ready to share it?</h1>

          {needSignIn && (
            <section className="pcard">
              <h2>Create your free account</h2>
              <p className="field-hint">So your page lives on our servers and opens on any phone. It takes a few seconds, and your work so far is kept.</p>
              <div><Button onClick={session.signIn}>Sign in or sign up</Button></div>
            </section>
          )}

          <section className="pcard">
            <h2><span className="num">1</span>Quick check</h2>
            {check.issues.length === 0 ? (
              <p className="ok-line"><Icon name="check" size={18} />Everything is filled in. Nothing left to fix.</p>
            ) : (
              <ul className="checklist">
                {errors.map((i, n) => (
                  <li key={`e${n}`} className="err">
                    <Icon name="alert" size={18} />
                    <span><b>{blockName(i.blockId)}:</b> {i.message}</span>
                    <a href={`#/edit/${id}?block=${i.blockId}`}>Fix</a>
                  </li>
                ))}
                {warnings.map((i, n) => (
                  <li key={`w${n}`} className="warn">
                    <Icon name="alert" size={18} />
                    <span><b>{blockName(i.blockId)}:</b> {i.message}</span>
                    <a href={`#/edit/${id}?block=${i.blockId}`}>Open</a>
                  </li>
                ))}
              </ul>
            )}
            {errors.length > 0 && <p className="field-hint">Fix the items marked in red to publish. Notes in amber are optional.</p>}
          </section>

          <section className="pcard">
            <h2><span className="num">2</span>Choose its link</h2>
            <Field>
              <div className="slug">
                <span>{window.location.host}/#/p/</span>
                <input className="in" value={slug} maxLength={30} aria-label="Page link" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="priya" />
              </div>
              <p className={`slug-status ${status === "ok" ? "ok" : "bad"}`}>{slug ? SLUG_MESSAGES[status] : "Pick a short, memorable name"}</p>
              {status !== "ok" && (
                <div className="chips">
                  {slugSuggestions(slug || heroName, (s) => slugTaken(s, id)).map((s) => (
                    <button key={s} type="button" className="chip" onClick={() => setSlug(s)}>{s}</button>
                  ))}
                </div>
              )}
            </Field>
          </section>

          <section className="pcard">
            <h2><span className="num">3</span>Who can open it</h2>
            <Segmented value={visibility} onChange={setVisibility} label="Visibility"
              options={[{ value: "unlisted", label: "Anyone with the link", icon: "link" }, { value: "private", label: "Only me", icon: "lock" }]} />
            <p className="field-hint">{visibility === "unlisted" ? "It never appears in search. Only people you send the link to can find it." : "Nobody else can open it. Good for drafts you are still polishing."}</p>
            <div className="switches">
              <Switch label="Protect with a password" hint="They need it to open the page" checked={usePw} onChange={setUsePw} />
              {usePw && (
                <input className="in" type="text" value={pw} placeholder={page.access.passwordHash ? "Leave blank to keep the current password" : "At least 4 characters"} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
              )}
              <Switch label="Keep it locked until a moment" hint="Perfect for midnight on their birthday. They see a countdown until then." checked={useLock} onChange={setUseLock} />
              {useLock && (
                <>
                  <input className="in" type="datetime-local" value={unlock} onChange={(e) => setUnlock(e.target.value)} aria-label="Unlock time" />
                  {lockInvalid && <p className="field-error">Pick a time in the future</p>}
                </>
              )}
              <Switch label="Switch it off on a date" hint="After this it says the page has ended" checked={useExpiry} onChange={setUseExpiry} />
              {useExpiry && (
                <>
                  <input className="in" type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry time" />
                  {expiryInvalid && <p className="field-error">Pick a time in the future</p>}
                  {isRemote() && <p className="field-hint">A day before it ends we email you, and anyone you sent the page to by email, so nobody misses it.</p>}
                </>
              )}
            </div>
            {(usePw || useLock) && (
              <p className="note-box"><Icon name="lock" size={16} />{isRemote()
                ? "Passwords and locks are enforced on our servers: a locked page is never sent to anyone before its time, not even to someone who looks at the network traffic."
                : `Once ${BRAND.name} is live, passwords and locks are enforced on our servers, so locked content is never sent to anyone early. In this preview they are enforced in your browser only.`}</p>
            )}
          </section>

          <div className="publish-cta">
            {page.takenDown && <p className="note-box">This page was taken down after a report, so it cannot be published. If you think that was a mistake, write to <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.</p>}
            <p className="field-hint">By publishing you agree to the <a href="#/terms" target="_blank" rel="noreferrer">Terms</a> and the <a href="#/privacy" target="_blank" rel="noreferrer">Privacy</a> page. Only share what you have the right to share, and only with people who would be glad to get it.</p>
            <Button size="lg" iconRight="right" disabled={!ready || busy || !!page.takenDown} onClick={publish}>{page.status === "published" ? "Update and share" : "Publish"}</Button>
            {error && <p className="field-error">{error}</p>}
            {!ready && <p className="field-hint">{needSignIn ? "Sign in to publish." : errors.length ? "Fix the red items above first." : status !== "ok" ? "Choose an available link." : "Check the options above."}</p>}
          </div>
        </div>

        <aside className="publish-side">
          <Thumb content={page.content} className="thumb-lg" />
          <p className="muted center">{page.title}{page.updatedAt && <> · edited {formatWhen(page.updatedAt)}</>}</p>
        </aside>
      </div>
    </Shell>
  );
}
