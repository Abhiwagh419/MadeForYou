import type { Template } from "@madeforyou/schema";
import { getOccasion, isTrending } from "@madeforyou/templates";
import { THEMES } from "@madeforyou/ui";
import { Icon } from "./Icon";
import { Thumb } from "./Thumb";

export function TemplateCard({ template, mine }: { template: Template; mine?: boolean }) {
  const { meta, content } = template;
  const occ = meta.occasions.map((o) => getOccasion(o)?.name).filter(Boolean) as string[];
  const theme = THEMES[content.settings.theme.preset];
  return (
    <a className="tcard" href={`#/t/${meta.id}`}>
      <div className="tcard-media">
        <Thumb content={content} />
        <span className="tcard-hover"><Icon name="eye" size={16} />Preview</span>
        {mine && <span className="badge badge-rose">Yours</span>}
        {isTrending(template) && <span className="badge badge-trend">Trending</span>}
      </div>
      <div className="tcard-body">
        <h2>{meta.title}</h2>
        <p>
          {occ.slice(0, 2).join(" · ")}
          {theme && <> · {theme.label}</>}
        </p>
        <div className="tcard-tags">
          {meta.languages.includes("hi") && <span className="chip chip-sm">English + हिन्दी</span>}
          {meta.moods.slice(0, 2).map((m) => <span key={m} className="chip chip-sm">{m}</span>)}
        </div>
      </div>
    </a>
  );
}
