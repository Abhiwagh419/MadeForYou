import { useMemo, useState } from "react";
import { checkPublishable, registry } from "@madeforyou/schema";
import { BRAND } from "@madeforyou/ui";
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

  const check = useMemo(() => checkPublishable(page.content), [page.content]);
  const errors = check.issues.filter((i) => i.severity === "error");
  const warnings = check.issues.filter((i) => i.severity === "warning");
  const status = slugStatus(slug, (s) => slugTaken(s, id));
  const pwNeeded = usePw && !page.access.passwordHash && pw.length < 4;
  const lockInvalid = useLock && (!unlock || new Date(unlock).getTime() <= Date.now());
  const expiryInvalid = useExpiry && (!expiry || new Date(expiry).getTime() <= Date.now());
  const ready = check.canPublish && status === "ok" && !pwNeeded && !lockInvalid && !expiryInvalid;

  const blockName = (bid: string) => registry[page.content.blocks.find((b) => b.id === bid)?.type ?? ""]?.label ?? "Block";

  const publish = async () => {
    setBusy(true);
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
                </>
              )}
            </div>
            {(usePw || useLock) && (
              <p className="note-box"><Icon name="lock" size={16} />Once {BRAND.name} is live, passwords and locks are enforced on our servers, so locked content is never sent to anyone early. In this preview they are enforced in your browser only.</p>
            )}
          </section>

          <div className="publish-cta">
            <Button size="lg" iconRight="right" disabled={!ready || busy} onClick={publish}>{page.status === "published" ? "Update and share" : "Publish"}</Button>
            {!ready && <p className="field-hint">{errors.length ? "Fix the red items above first." : status !== "ok" ? "Choose an available link." : "Check the options above."}</p>}
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
