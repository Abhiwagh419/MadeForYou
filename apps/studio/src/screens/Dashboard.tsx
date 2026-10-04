import { useMemo, useState } from "react";
import { deletePage, deleteTemplate, duplicatePage, useStore, type PageRecord } from "../state/store";
import { formatWhen } from "../lib/util";
import { go } from "../lib/router";
import { Button } from "../ui/Button";
import { Segmented, Sheet, toast } from "../ui/Controls";
import { Shell } from "../ui/Shell";
import { TemplateCard } from "../ui/TemplateCard";
import { Thumb } from "../ui/Thumb";

function status(p: PageRecord): { label: string; tone: string } {
  if (p.status === "draft") return { label: "Draft", tone: "" };
  if (p.access.expiresAt && new Date(p.access.expiresAt).getTime() < Date.now()) return { label: "Ended", tone: "" };
  if (p.access.unlockAt && new Date(p.access.unlockAt).getTime() > Date.now()) return { label: `Locked until ${formatWhen(p.access.unlockAt)}`, tone: "amber" };
  return { label: "Live", tone: "green" };
}

export function Dashboard() {
  // Select the stable objects and derive lists here: a selector that builds a new array on every call
  // makes useSyncExternalStore re-render forever.
  const pageMap = useStore((s) => s.pages);
  const templateMap = useStore((s) => s.templates);
  const pages = useMemo(() => Object.values(pageMap).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [pageMap]);
  const mine = useMemo(() => Object.values(templateMap), [templateMap]);
  const [tab, setTab] = useState<"pages" | "templates">("pages");
  const [doomed, setDoomed] = useState<PageRecord | null>(null);

  return (
    <Shell active="me">
      <div className="wrap page-head">
        <div className="head-row">
          <h1>{tab === "pages" ? "Your pages" : "Your templates"}</h1>
          <Button href="#/templates" icon="plus">Create new</Button>
        </div>
        <Segmented value={tab} onChange={setTab} label="Show"
          options={[{ value: "pages", label: `Pages (${pages.length})` }, { value: "templates", label: `Templates (${mine.length})` }]} />
      </div>

      <div className="wrap">
        {tab === "pages" ? (
          pages.length === 0 ? (
            <div className="empty empty-left">
              <div className="empty-arch" aria-hidden="true" />
              <h2>Nothing here yet</h2>
              <p>Pick a template, answer a few questions, and your first page is ready in about three minutes.</p>
              <Button size="lg" href="#/templates" iconRight="right">Find a template</Button>
            </div>
          ) : (
            <div className="tgrid">
              {pages.map((p) => {
                const st = status(p);
                return (
                  <article className="pagecard" key={p.id}>
                    <a className="pagecard-media" href={`#/edit/${p.id}`} aria-label={`Edit ${p.title}`}><Thumb content={p.content} /></a>
                    <div className="tcard-body">
                      <h3>{p.title}</h3>
                      <p><span className={`badge ${st.tone ? `badge-${st.tone}` : ""}`}>{st.label}</span> <span className="muted">edited {formatWhen(p.updatedAt)}</span></p>
                      <div className="card-actions">
                        <Button size="sm" variant="secondary" icon="pencil" href={`#/edit/${p.id}`}>Edit</Button>
                        {p.status === "published"
                          ? <Button size="sm" variant="ghost" icon="share" href={`#/share/${p.id}`}>Share</Button>
                          : <Button size="sm" variant="ghost" iconRight="right" href={`#/publish/${p.id}`}>Publish</Button>}
                        <Button size="sm" variant="ghost" icon="copy" aria-label="Duplicate" onClick={() => { const c = duplicatePage(p.id); if (c) toast("Copied"); }} />
                        <Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => setDoomed(p)} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : mine.length === 0 ? (
          <div className="empty empty-left">
            <div className="empty-arch" aria-hidden="true" />
            <h2>No templates yet</h2>
            <p>Open any of your pages and choose “Share as a template”. We strip out the personal parts so only the design is shared.</p>
          </div>
        ) : (
          <div className="tgrid">
            {mine.map((r) => (
              <div key={r.template.meta.id}>
                <TemplateCard template={r.template} mine />
                <Button variant="ghost" size="sm" icon="trash" onClick={() => { deleteTemplate(r.template.meta.id); toast("Template removed"); }}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!doomed} onClose={() => setDoomed(null)} title="Delete this page?">
        <p>“{doomed?.title}” will be removed from this device. This cannot be undone.</p>
        <div className="cta-row">
          <Button variant="secondary" onClick={() => setDoomed(null)}>Keep it</Button>
          <Button variant="danger" icon="trash" onClick={() => { if (doomed) deletePage(doomed.id); setDoomed(null); go("/me"); }}>Delete</Button>
        </div>
      </Sheet>
    </Shell>
  );
}
