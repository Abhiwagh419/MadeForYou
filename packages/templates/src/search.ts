import type { Template } from "@madeforyou/schema";
import { OCCASIONS, type Occasion } from "./occasions";

/** Lowercase, drop Latin accents and apostrophes, collapse punctuation. Devanagari is left untouched. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Edit distance where swapping two neighbours counts once ("birthdya" is one slip, not two). */
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/** 100 exact, 80 prefix, 60 contains, 60 minus 8 per typo; 0 for no match. */
export function scoreTerm(q: string, term: string): number {
  if (!q || !term) return 0;
  if (q === term) return 100;
  if (q.length >= 2 && term.startsWith(q)) return 80;
  if (q.length >= 4 && q.startsWith(term) && term.length >= 3) return 78;
  if (q.length >= 3 && term.includes(q)) return 60;
  if (q.length >= 4) {
    const max = q.length <= 5 ? 1 : 2;
    const d = distance(q, term, max);
    if (d <= max) return 60 - d * 8;
  }
  return 0;
}

const termsOf = (o: Occasion) => [o.name, ...(o.hi ? [o.hi] : []), ...o.synonyms].map(normalize);

export function scoreOccasion(q: string, o: Occasion): number {
  const nq = normalize(q);
  let best = 0;
  for (const t of termsOf(o)) best = Math.max(best, scoreTerm(nq, t));
  // multi-word queries: score the best single word too ("my mom birthday")
  if (nq.includes(" ")) {
    for (const w of nq.split(" ")) for (const t of termsOf(o)) best = Math.max(best, scoreTerm(w, t) - 10);
  }
  return best;
}

/** Typeahead: occasions that match, best first. */
export function suggest(q: string, limit = 6): Occasion[] {
  if (!normalize(q)) return [];
  return OCCASIONS.map((o) => ({ o, s: scoreOccasion(q, o) }))
    .filter((x) => x.s >= 40)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.o);
}

export interface SearchResult {
  /** The occasion the query resolved to, if any. */
  occasion: Occasion | null;
  results: Template[];
  /** Other occasions worth showing when nothing matched. */
  related: Occasion[];
}

/**
 * Empty query returns everything. Otherwise templates are ranked by how well their
 * occasions match, then by title and tags. Zero results is a normal outcome: the UI
 * answers it with "create the first one".
 */
export function searchTemplates(q: string, templates: Template[]): SearchResult {
  const nq = normalize(q);
  if (!nq) return { occasion: null, results: templates, related: [] };

  const ranked = OCCASIONS.map((o) => ({ o, s: scoreOccasion(q, o) })).filter((x) => x.s >= 40).sort((a, b) => b.s - a.s);
  const occScore = new Map(ranked.map((x) => [x.o.id, x.s]));

  const scored = templates
    .map((t) => {
      let s = Math.max(0, ...t.meta.occasions.map((id) => occScore.get(id) ?? 0));
      const words = nq.split(" ");
      const hay = [t.meta.title, ...t.meta.tags, ...t.meta.relationships].map(normalize);
      for (const w of words) for (const h of hay) s = Math.max(s, Math.min(55, scoreTerm(w, h)));
      return { t, s };
    })
    .filter((x) => x.s >= 40)
    .sort((a, b) => b.s - a.s);

  return {
    occasion: ranked[0]?.o ?? null,
    results: scored.map((x) => x.t),
    related: scored.length ? [] : OCCASIONS.filter((o) => o.id !== ranked[0]?.o.id).slice(0, 6),
  };
}
