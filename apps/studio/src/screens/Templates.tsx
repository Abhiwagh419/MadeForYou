import { useMemo, useState } from "react";
import type { Template } from "@madeforyou/schema";
import { OCCASIONS, searchTemplates, templates } from "@madeforyou/templates";
import { useRoute } from "../lib/router";
import { startFromScratch } from "../lib/actions";
import { useStore } from "../state/store";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Controls";
import { SearchBox } from "../ui/SearchBox";
import { Shell } from "../ui/Shell";
import { TemplateCard } from "../ui/TemplateCard";

type Mood = "all" | "romantic" | "emotional" | "festive" | "funny" | "minimal";

export function Templates() {
  const q = useRoute().query.get("q") ?? "";
  const mine = useStore((s) => s.templates);
  const [mood, setMood] = useState<Mood>("all");
  const [lang, setLang] = useState<"all" | "hi">("all");

  const mineList = useMemo(() => Object.values(mine).map((r) => r.template), [mine]);
  const all = useMemo(() => [...mineList, ...templates], [mineList]);
  const mineIds = useMemo(() => new Set(mineList.map((t) => t.meta.id)), [mineList]);
  const res = useMemo(() => searchTemplates(q, all), [q, all]);

  const shown = res.results.filter(
    (t) => (mood === "all" || t.meta.moods.includes(mood)) && (lang === "all" || t.meta.languages.includes("hi")),
  );

  // For an occasion with no templates yet: the closest ones to start from.
  const similar: Template[] = useMemo(() => {
    const group = res.occasion?.group;
    const sameGroup = all.filter((t) => t.meta.occasions.some((o) => OCCASIONS.find((x) => x.id === o)?.group === group));
    return (sameGroup.length ? sameGroup : all).slice(0, 3);
  }, [res.occasion, all]);

  return (
    <Shell active="templates">
      <div className="wrap page-head">
        <h1>{q ? <>Results for <em>“{q}”</em></> : "All templates"}</h1>
        {res.occasion && shown.length > 0 && <p className="muted">Showing templates for {res.occasion.name}.</p>}
        <SearchBox initial={q} />
        <div className="filters">
          <Segmented<Mood> value={mood} onChange={setMood} label="Mood"
            options={[{ value: "all", label: "All moods" }, { value: "romantic", label: "Romantic" }, { value: "emotional", label: "Emotional" }, { value: "festive", label: "Festive" }, { value: "funny", label: "Funny" }]} />
          <Segmented<"all" | "hi"> value={lang} onChange={setLang} label="Language"
            options={[{ value: "all", label: "Any language" }, { value: "hi", label: "हिन्दी" }]} />
        </div>
      </div>

      <div className="wrap">
        {shown.length > 0 ? (
          <>
            <p className="muted count-line">{shown.length} template{shown.length === 1 ? "" : "s"}</p>
            <div className="tgrid">{shown.map((t) => <TemplateCard key={t.meta.id} template={t} mine={mineIds.has(t.meta.id)} />)}</div>
          </>
        ) : (
          <div className="empty empty-left">
            <div className="empty-arch" aria-hidden="true" />
            <h2>{q ? <>No template for “{q}” yet</> : "Nothing matches those filters"}</h2>
            <p>
              {q
                ? "You could be the first. Start from a similar template, or from a simple page with a cover, a message, photos and a signature. You can share it as a template afterwards."
                : "Try clearing a filter."}
            </p>
            <div className="empty-actions">
              {q && <Button icon="plus" size="lg" onClick={() => startFromScratch(q)}>Create the first one</Button>}
              {!q && <Button variant="secondary" onClick={() => { setMood("all"); setLang("all"); }}>Clear filters</Button>}
            </div>
            {q && similar.length > 0 && (
              <>
                <h3 className="similar-h">Or start from something close</h3>
                <div className="tgrid">{similar.map((t) => <TemplateCard key={t.meta.id} template={t} />)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
