import { useEffect, useRef, useState } from "react";
import { guidedQuestions, isEmpty, registry, setField, type Content, type GuidedQuestion } from "@madeforyou/schema";
import { useStore, savePage } from "../state/store";
import { go, useRoute } from "../lib/router";
import { scrollToBlock } from "../lib/util";
import { Button } from "../ui/Button";
import { Sheet, useMedia } from "../ui/Controls";
import { FieldInput, frameLock } from "../ui/Fields";
import { PhonePreview } from "../ui/PhonePreview";
import { Mark } from "../ui/Logo";
import { NotFound } from "../ui/Shell";

type Step = { kind: "q"; q: GuidedQuestion } | { kind: "bridge"; count: number };

export function buildSteps(content: Content): Step[] {
  const qs = guidedQuestions(content);
  const essential = qs.filter((q) => q.tier === "essential");
  const richer = qs.filter((q) => q.tier === "richer");
  return [
    ...essential.map((q): Step => ({ kind: "q", q })),
    ...(richer.length ? [{ kind: "bridge", count: richer.length } as Step, ...richer.map((q): Step => ({ kind: "q", q }))] : []),
  ];
}

export function Guided() {
  const { id = "" } = useRoute().params;
  const page = useStore((s) => s.pages[id]);
  const steps = useRef<Step[] | null>(null);
  if (page && !steps.current) steps.current = buildSteps(page.content);
  const [i, setI] = useState(0);
  const [peek, setPeek] = useState(false);
  const mobile = useMedia("(max-width: 900px)");
  const scroller = useRef<HTMLDivElement>(null);

  const list = steps.current ?? [];
  const step = list[i];

  useEffect(() => {
    if (page && list.length === 0) go(`/edit/${id}`);
  }, [page, list.length, id]);

  useEffect(() => {
    if (step?.kind === "q") scrollToBlock(scroller.current, step.q.blockId);
  }, [step]);

  if (!page) return <NotFound />;
  if (!step) return null;

  const finish = () => go(`/publish/${id}`);
  const next = () => (i + 1 >= list.length ? finish() : setI(i + 1));
  const skipToEnd = () => finish();
  const preview = (
    <PhonePreview ref={scroller} content={page.content} skipOpening />
  );

  let body;
  if (step.kind === "bridge") {
    body = (
      <>
        <p className="eyebrow-soft">Nicely done</p>
        <h1>Your page is taking shape</h1>
        <p className="lede-sm">
          Those were the essentials. {step.count} more question{step.count === 1 ? "" : "s"} can make it richer: a cover
          photo, a subtitle, how the letter opens and ends. Skip any of them and the page still looks good.
        </p>
        <div className="guided-nav">
          <Button size="lg" iconRight="right" onClick={next}>Make it richer</Button>
          <Button size="lg" variant="secondary" onClick={skipToEnd}>Looks good, continue</Button>
        </div>
      </>
    );
  } else {
    const { q } = step;
    const block = page.content.blocks.find((b) => b.id === q.blockId)!;
    const def = registry[block.type]!.fields[q.field]!;
    const isPh = block.ph.includes(q.field);
    const value = block.fields[q.field];
    const filled = !isPh && !isEmpty(def, value);
    const answer = (v: unknown) => savePage(id, { content: setField(page.content, q.blockId, q.field, v) });
    body = (
      <>
        <p className="eyebrow-soft">{registry[block.type]?.label}</p>
        <h1>{q.prompt}</h1>
        <FieldInput large name={q.field} def={def} value={value} isPh={isPh} onChange={answer} lock={frameLock(block, q.field, page.content.settings.theme.preset)} />
        <div className="guided-nav">
          {i > 0 && <Button variant="ghost" icon="left" onClick={() => setI(i - 1)}>Back</Button>}
          <span className="grow" />
          {!q.required && !filled && <Button variant="ghost" onClick={next}>Skip</Button>}
          <Button size="lg" iconRight="right" disabled={q.required && !filled} onClick={next}>
            {i + 1 >= list.length ? "Finish" : "Next"}
          </Button>
        </div>
        {q.required && !filled && <p className="field-hint">This one is needed before you can publish.</p>}
      </>
    );
  }

  return (
    <div className="guided">
      <header className="guided-top">
        <a className="guided-brand" href="#/me" aria-label="Save and leave"><Mark size={24} /></a>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={i}>
          <i style={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <span className="muted step-count">{i + 1} / {list.length}</span>
        <Button href={`#/edit/${id}`} variant="ghost" size="sm" icon="sliders">Open editor</Button>
      </header>
      <div className="guided-body">
        <section className="guided-q" key={i}>{body}</section>
        {!mobile && <aside className="guided-preview">{preview}</aside>}
      </div>
      {mobile && (
        <>
          <button type="button" className="peek" onClick={() => setPeek(true)}>
            <span>See your page</span>
          </button>
          <Sheet open={peek} onClose={() => setPeek(false)} title="Your page">
            <div className="peek-body">{peek && preview}</div>
          </Sheet>
        </>
      )}
    </div>
  );
}
