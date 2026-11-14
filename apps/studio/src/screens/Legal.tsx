import { useEffect } from "react";
import { BRAND } from "@madeforyou/ui";
import { PRIVACY, TERMS, type Legal } from "../lib/legal";
import { Shell } from "../ui/Shell";

function Doc({ doc, other }: { doc: Legal; other: { href: string; label: string } }) {
  useEffect(() => {
    document.title = `${doc.title} · ${BRAND.name}`;
    window.scrollTo(0, 0);
  }, [doc.title]);
  return (
    <Shell>
      <article className="wrap legal">
        <h1>{doc.title}</h1>
        <p className="legal-updated">Last updated {doc.updated}</p>
        <p className="note-box legal-summary"><b>In short:</b> {doc.summary}</p>
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((t) => <p key={t}>{t}</p>)}
            {s.ul && <ul>{s.ul.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        ))}
        <p className="legal-end">Questions? <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a> · <a href={other.href}>{other.label}</a></p>
      </article>
    </Shell>
  );
}

export const Terms = () => <Doc doc={TERMS} other={{ href: "#/privacy", label: "Privacy" }} />;
export const Privacy = () => <Doc doc={PRIVACY} other={{ href: "#/terms", label: "Terms of use" }} />;
