import { useMemo, useState } from "react";
import { personalNames, registry, stripPersonal, validateTemplate, type AssetRef } from "@madeforyou/schema";
import { OCCASIONS } from "@madeforyou/templates";
import { go, useRoute } from "../lib/router";
import { humanize, slugify } from "../lib/util";
import { addTemplate, useStore } from "../state/store";
import { useSession } from "../lib/auth";
import { isRemote } from "../lib/config";
import { pushTemplate } from "../lib/sync";
import { Button } from "../ui/Button";
import { Segmented, Switch, toast } from "../ui/Controls";
import { Field } from "../ui/Fields";
import { Icon } from "../ui/Icon";
import { NotFound, Shell } from "../ui/Shell";
import { Thumb } from "../ui/Thumb";

const MOODS = ["romantic", "emotional", "festive", "funny", "minimal"] as const;

function describe(v: unknown): string {
  if (typeof v === "string") return v.trim() ? `“${v.trim().slice(0, 40)}${v.length > 40 ? "…" : ""}”` : "Empty";
  if (Array.isArray(v)) return v.length ? `${v.length} item${v.length === 1 ? "" : "s"}` : "Empty";
  if (v && typeof v === "object" && "asset" in (v as AssetRef)) return "A photo";
  return v ? String(v) : "Empty";
}

export function TemplateFrom() {
  const { id = "" } = useRoute().params;
  const page = useStore((s) => s.pages[id]);
  const session = useSession();
  const [keep, setKeep] = useState<Record<string, string[]>>({});
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState(OCCASIONS.find((o) => o.id === "birthday")?.id ?? "");
  const [moods, setMoods] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [error, setError] = useState("");

  const stripped = useMemo(() => (page ? stripPersonal(page.content, { keep }) : null), [page, keep]);
  const names = useMemo(() => (page ? personalNames(page.content) : []), [page]);
  const leaks = names.filter((n) => `${title} ${tags}`.toLowerCase().includes(n));
  if (!page || !stripped) return <NotFound />;

  const rows = page.content.blocks.flatMap((b) => {
    const def = registry[b.type];
    return Object.entries(def?.fields ?? {})
      .filter(([, f]) => f.personal)
      .map(([name]) => ({ block: b, label: def!.label, name, value: b.fields[name], kept: !!keep[b.id]?.includes(name) }));
  });
  const removing = rows.filter((r) => !r.kept).length;
  const toggle = (blockId: string, name: string, on: boolean) =>
    setKeep((k) => {
      const cur = new Set(k[blockId] ?? []);
      on ? cur.add(name) : cur.delete(name);
      return { ...k, [blockId]: [...cur] };
    });

  const create = () => {
    const tid = `${slugify(title).slice(0, 28) || "template"}-${Math.random().toString(36).slice(2, 6)}`;
    const r = validateTemplate({
      meta: {
        id: tid, title: title.trim(), occasions: [occasion], relationships: [], moods,
        tags: tags.split(",").map((t) => t.trim()).filter((t) => t.length >= 2).slice(0, 20),
        languages: stripped.content.settings.languages.available, visibility,
      },
      content: stripped.content,
    });
    if (!r.ok) return setError(r.issues.map((i) => i.message).join(". "));
    addTemplate(r.template, id);
    toast("Template created");
    if (isRemote() && session.userId) {
      pushTemplate(r.template, id).catch((e) => toast(`Saved here, but not to your account: ${(e as Error).message}`));
    }
    go(`/t/${tid}`);
  };

  return (
    <Shell>
      <div className="wrap publish">
        <div className="publish-main">
          <a className="back" href={`#/share/${id}`}>← Back</a>
          <h1>Share it as a template</h1>
          <p className="lede-sm">Other people will start from your design. Nothing personal goes with it unless you choose to keep it.</p>

          <section className="pcard">
            <h2><span className="num">1</span>What stays private</h2>
            <p className="field-hint"><b>{removing}</b> personal item{removing === 1 ? "" : "s"} will be replaced with sample text. Switch on “Keep” only for wording you want others to reuse, like a greeting.</p>
            <ul className="strip-list">
              {rows.map((r) => (
                <li key={`${r.block.id}-${r.name}`} className={r.kept ? "kept" : ""}>
                  <span className="strip-ico">{r.kept ? <Icon name="eye" size={16} /> : <Icon name="lock" size={16} />}</span>
                  <span className="strip-text"><b>{r.label} · {humanize(r.name)}</b><small>{describe(r.value)}</small></span>
                  <Switch label={r.kept ? "Kept" : "Removed"} checked={r.kept} onChange={(v) => toggle(r.block.id, r.name, v)} />
                </li>
              ))}
            </ul>
          </section>

          <section className="pcard">
            <h2><span className="num">2</span>Describe it</h2>
            <Field label="Template name" hint="Describe the design, not the person. Example: “A letter for Maa”.">
              <input className="in" value={title} maxLength={80} placeholder="A birthday surprise for a friend" onChange={(e) => setTitle(e.target.value)} />
              {leaks.length > 0 && <p className="field-error">This includes “{leaks[0]}”, a name from your page. Others would see it, so please remove it.</p>}
            </Field>
            <Field label="Occasion" hint="This is how people will find it in search.">
              <select className="in" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                {OCCASIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Mood">
              <div className="chips">
                {MOODS.map((m) => (
                  <button key={m} type="button" className={`chip ${moods.includes(m) ? "on" : ""}`} aria-pressed={moods.includes(m)}
                    onClick={() => setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].slice(0, 3)))}>{m}</button>
                ))}
              </div>
            </Field>
            <Field label="Search words" hint="Separated by commas, e.g. maa, mom, mummy"><input className="in" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="maa, mom, mummy" /></Field>
          </section>

          <section className="pcard">
            <h2><span className="num">3</span>Who can use it</h2>
            <Segmented value={visibility} onChange={setVisibility} label="Template visibility"
              options={[{ value: "private", label: "Only me", icon: "lock" }, { value: "unlisted", label: "Anyone with link", icon: "link" }, { value: "public", label: "Everyone", icon: "globe" }]} />
            <p className="field-hint">{visibility === "public" ? "Appears in search for everyone. Once live, new creators’ public templates are checked before they appear." : visibility === "unlisted" ? "Not in search. Anyone you send the link to can use it." : "Only you can find and use it."}</p>
          </section>

          {error && <p className="field-error">{error}</p>}
          <div className="publish-cta">
            <Button size="lg" iconRight="right" disabled={title.trim().length < 3 || leaks.length > 0} onClick={create}>Create template</Button>
          </div>
        </div>
        <aside className="publish-side">
          <Thumb content={stripped.content} className="thumb-lg" />
          <p className="muted center">Preview of what others will see</p>
        </aside>
      </div>
    </Shell>
  );
}
