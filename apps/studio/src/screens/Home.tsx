import { useMemo } from "react";
import { getTemplate, templates } from "@madeforyou/templates";
import { Button } from "../ui/Button";
import { Shell } from "../ui/Shell";
import { SearchBox } from "../ui/SearchBox";
import { PhoneThumb } from "../ui/Thumb";
import { TemplateCard } from "../ui/TemplateCard";
import { startFromScratch } from "../lib/actions";

const CHIPS = ["Mother's Day", "Girlfriend's Day", "Birthday", "Raksha Bandhan", "Diwali", "Anniversary", "Farewell", "Thank you", "Sorry"];
const HERO = ["raksha-bandhan-bond", "mothers-day-letter", "girlfriends-day-love"];
const POPULAR = ["mothers-day-letter", "girlfriends-day-love", "birthday-countdown", "raksha-bandhan-bond", "fathers-day-note", "diwali-wishes"];

const STEPS = [
  { n: "1", title: "Pick a starting point", text: "Search for who it is for or what you are celebrating. Every template is a real page, not a picture of one." },
  { n: "2", title: "Answer a few questions", text: "Her name, a message, five photos. We turn your answers into the page while you watch." },
  { n: "3", title: "Send the link", text: "Share on WhatsApp, lock it until midnight on their birthday, or print the QR code on a card." },
];

export function Home() {
  const hero = useMemo(() => HERO.map((id) => getTemplate(id)).filter(Boolean), []);
  const popular = useMemo(() => POPULAR.map((id) => getTemplate(id)).filter(Boolean), []);

  return (
    <Shell>
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <h1>Say it with a page made <em>just for them.</em></h1>
            <p className="lede">
              Beautiful personal pages for mothers, partners, friends and festivals. No design skills, no code, and it
              is free.
            </p>
            <SearchBox large />
            <div className="chips" aria-label="Popular occasions">
              {CHIPS.map((c) => <a key={c} className="chip" href={`#/templates?q=${encodeURIComponent(c)}`}>{c}</a>)}
            </div>
          </div>
          <div className="hero-phones" aria-hidden="true" inert>
            {hero.map((t, i) => t && <PhoneThumb key={t.meta.id} content={t.content} className={`hp hp-${i + 1}`} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Start from something lovely</h2>
            <Button href="#/templates" variant="ghost" iconRight="right">Browse all {templates.length}</Button>
          </div>
          <div className="tgrid">
            {popular.map((t) => t && <TemplateCard key={t.meta.id} template={t} />)}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="wrap">
          <h2 className="center">Three minutes, start to finish</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="step-n" aria-hidden="true">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap band">
          <div>
            <h2>Cannot find what you need?</h2>
            <p>Make the first one. We will start you with a cover, a message, photos and a signature, so you never face a blank page.</p>
          </div>
          <Button size="lg" icon="plus" onClick={() => startFromScratch()}>Start from scratch</Button>
        </div>
      </section>
    </Shell>
  );
}
