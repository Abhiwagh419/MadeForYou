import { useMemo, useState } from "react";
import { getOccasion } from "@madeforyou/templates";
import { THEMES } from "@madeforyou/ui";
import { useAllTemplates } from "../state/library";
import { useRoute } from "../lib/router";
import { startFromTemplate } from "../lib/actions";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Controls";
import { PhonePreview } from "../ui/PhonePreview";
import { NotFound, Shell } from "../ui/Shell";

export function TemplatePreview() {
  const { id = "" } = useRoute().params;
  const { all } = useAllTemplates();
  const t = useMemo(() => all.find((x) => x.meta.id === id), [id, all]);
  const [lang, setLang] = useState("en");
  const [replay, setReplay] = useState(0);

  if (!t) return <NotFound what="template" />;
  const { meta, content } = t;
  const langs = content.settings.languages.available;
  const occ = meta.occasions.map((o) => getOccasion(o)?.name).filter(Boolean);

  return (
    <Shell active="templates">
      <div className="wrap tpreview">
        <div className="tpreview-stage">
          <PhonePreview content={content} lang={lang} replayKey={replay} />
          <Button variant="ghost" size="sm" icon="play" onClick={() => setReplay((n) => n + 1)}>Replay opening</Button>
        </div>
        <aside className="tpreview-info">
          <a className="back" href="#/templates">← All templates</a>
          <h1>{meta.title}</h1>
          <p className="muted">{occ.join(" · ")} · {THEMES[content.settings.theme.preset]?.label} look</p>
          <div className="chips">
            {meta.moods.map((m) => <span key={m} className="chip chip-sm">{m}</span>)}
            {meta.relationships.map((r) => <span key={r} className="chip chip-sm">for {r}</span>)}
          </div>
          {langs.length > 1 && (
            <div className="field">
              <div className="field-head"><label>Preview language</label></div>
              <Segmented value={lang} onChange={setLang} options={langs.map((l) => ({ value: l, label: l === "hi" ? "हिन्दी" : "English" }))} />
            </div>
          )}
          <ul className="ticks">
            <li>Answer a few questions and the page fills itself in</li>
            <li>Change anything afterwards: photos, words, colours, order</li>
            <li>Lock it, password it, or send it on WhatsApp</li>
          </ul>
          <div className="cta-row">
            <Button size="lg" iconRight="right" onClick={() => startFromTemplate(t)}>Use this template</Button>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
