import { useMemo, useState } from "react";
import { suggest } from "@madeforyou/templates";
import { go } from "../lib/router";
import { Button } from "./Button";
import { Icon } from "./Icon";

export function SearchBox({ initial = "", large, autoFocus }: { initial?: string; large?: boolean; autoFocus?: boolean }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const found = useMemo(() => suggest(q), [q]);
  const submit = (text: string) => {
    setOpen(false);
    go(`/templates?q=${encodeURIComponent(text.trim())}`);
  };
  return (
    <form className={`search ${large ? "search-lg" : ""}`} role="search" onSubmit={(e) => { e.preventDefault(); submit(q); }}>
      <Icon name="search" size={large ? 22 : 18} />
      <input
        value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
        placeholder="Try “maa”, “rakhi”, “girlfriend”" aria-label="Search templates"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 140)}
      />
      <Button type="submit" size={large ? "lg" : "md"} iconRight="right" aria-label="Search">Search</Button>
      {open && found.length > 0 && (
        <ul className="suggest" role="listbox">
          {found.map((o) => (
            <li key={o.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); submit(o.name); }}>
                <Icon name="sparkle" size={16} />
                <span>{o.name}</span>
                {o.hi && <small>{o.hi}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
