import { useMemo, useState } from "react";
import { PageRenderer } from "@madeforyou/renderer";
import "@madeforyou/renderer/styles.css";
import {
  checkPublishable, guidedQuestions, setField, starterSkeleton, stripPersonal,
  type AssetRef, type Content,
} from "@madeforyou/schema";
import { templates } from "@madeforyou/templates";
import { BRAND, THEMES } from "@madeforyou/ui";
import "./app.css";

const SOURCES = [
  ...templates.map((t) => ({ id: t.meta.id, title: t.meta.title, make: () => structuredClone(t.content) })),
  { id: "starter", title: "Starter skeleton (empty search)", make: () => starterSkeleton() },
];

const PALETTES: [string, string][] = [["#fbcfe8", "#f43f5e"], ["#fde68a", "#f59e0b"], ["#ddd6fe", "#7c3aed"], ["#bbf7d0", "#16a34a"]];

/** Stand-in for the real asset service: any asset reference becomes a gradient tile. */
function demoAsset(ref: AssetRef): string {
  const n = [...ref.asset].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = PALETTES[n % PALETTES.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Keyed "blockType.field" first, then "field", so a countdown's title is not "Happy Birthday".
const DEMO_TEXT: Record<string, string> = {
  "countdown.title": "Until your day",
  recipient: "Priya", title: "Happy Birthday", subtitle: "Made with love, just for you",
  heading: "Why you matter", body: "You turn ordinary days into the ones I remember.\n\nThank you for every small thing you do without being asked.",
  salutation: "Dear Priya,", closing: "Always yours,", message: "With love,", name: "Abhi", endMessage: "Today is the day!",
};

/** Simulates a user answering every guided question. Goes through setField, like the real editor will. */
function fillDemo(c: Content): Content {
  let next = c;
  for (const q of guidedQuestions(c)) {
    let value: unknown;
    if (q.kind === "text" || q.kind === "longtext") value = DEMO_TEXT[`${q.blockType}.${q.field}`] ?? DEMO_TEXT[q.field] ?? "Sample";
    else if (q.kind === "date") value = "2027-02-14";
    else if (q.kind === "image") value = { asset: "ast_demo_cover", alt: "Demo photo" };
    else if (q.kind === "list")
      value = [1, 2, 3, 4].map((i) => ({ image: { asset: `ast_demo_${i}`, alt: `Demo photo ${i}` }, caption: `Memory ${i}` }));
    else continue;
    next = setField(next, q.blockId, q.field, value);
  }
  return next;
}

export function App() {
  const [sourceId, setSourceId] = useState(SOURCES[0]!.id);
  const [content, setContent] = useState<Content>(() => SOURCES[0]!.make());
  const [lang, setLang] = useState("en");
  const [skip, setSkip] = useState(false);
  const [replay, setReplay] = useState(0);
  const [note, setNote] = useState("");

  const questions = useMemo(() => guidedQuestions(content), [content]);
  const check = useMemo(() => checkPublishable(content), [content]);
  const langs = content.settings.languages.available;

  const load = (id: string) => {
    setSourceId(id);
    setContent(SOURCES.find((s) => s.id === id)!.make());
    setLang("en");
    setNote("");
    setReplay((n) => n + 1);
  };

  return (
    <div className="shell">
      <aside className="panel">
        <h1>{BRAND.name} <span>preview</span></h1>

        <label>Template
          <select value={sourceId} onChange={(e) => load(e.target.value)}>
            {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <label>Language
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {langs.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label>Theme
          <select
            value={content.settings.theme.preset}
            onChange={(e) => setContent({ ...content, settings: { ...content.settings, theme: { preset: e.target.value } } })}
          >
            {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </label>
        <label className="row"><input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip opening screen</label>

        <div className="buttons">
          <button onClick={() => setReplay((n) => n + 1)}>Replay opening</button>
          <button onClick={() => { setContent(fillDemo(content)); setNote(""); }}>Answer all questions</button>
          <button
            onClick={() => {
              const r = stripPersonal(content);
              setContent(r.content);
              setNote(`Share as template: ${r.report.filter((x) => x.action === "stripped").length} personal fields reset to placeholders.`);
            }}
          >Share as template</button>
          <button onClick={() => load(sourceId)}>Reset</button>
        </div>
        {note && <p className="note">{note}</p>}

        <h2>Guided questions <small>({questions.length})</small></h2>
        {questions.length === 0 ? <p className="muted">Nothing left to ask.</p> : (
          <ol>{questions.map((q) => (
            <li key={q.blockId + q.field}>{q.prompt} <small className={q.tier}>{q.tier}</small></li>
          ))}</ol>
        )}

        <h2>Publish check</h2>
        <p className={check.canPublish ? "ok" : "bad"}>{check.canPublish ? "Ready to publish" : "Not ready to publish"}</p>
        <ul>{check.issues.map((i, n) => (
          <li key={n} className={i.severity}>{i.severity === "error" ? "Needs: " : "Note: "}{i.message}</li>
        ))}</ul>
      </aside>

      <main className="stage">
        <div className="phone">
          {/* phone-screen is the containing block for the page's fixed layers (petals, music),
              so they stay inside the frame instead of covering this whole window. */}
          <div className="phone-screen">
            <div className="phone-scroll">
              <PageRenderer
                key={`${sourceId}-${replay}-${skip}`}
                content={content}
                lang={lang}
                skipOpening={skip}
                resolveAsset={demoAsset}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
