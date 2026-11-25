import { describe, expect, it } from "vitest";
import { OCCASIONS, getOccasion, isTrending, normalize, searchTemplates, suggest, templates, distance } from "../src";

const ids = (q: string) => searchTemplates(q, templates).results.map((t) => t.meta.id);

describe("library", () => {
  it("has a dozen templates across many occasions, all with unique ids", () => {
    expect(templates.length).toBeGreaterThanOrEqual(12);
    expect(new Set(templates.map((t) => t.meta.id)).size).toBe(templates.length);
  });
  it("only references occasions that exist in the vocabulary", () => {
    for (const t of templates) for (const o of t.meta.occasions) expect(getOccasion(o), `${t.meta.id} -> ${o}`).toBeTruthy();
  });
  it("covers the occasions the product was started for", () => {
    const covered = new Set(templates.flatMap((t) => t.meta.occasions));
    for (const o of ["mothers-day", "fathers-day", "girlfriends-day", "birthday", "raksha-bandhan", "diwali"]) expect(covered.has(o)).toBe(true);
  });
  it("has a template for every occasion in the vocabulary", () => {
    const covered = new Set(templates.flatMap((t) => t.meta.occasions));
    for (const o of OCCASIONS) expect(covered.has(o.id), o.id).toBe(true);
  });
  it("has a good set of trending templates", () => {
    expect(templates.filter(isTrending).length).toBeGreaterThanOrEqual(12);
  });
  it("has unique occasion ids and synonyms that do not repeat across occasions", () => {
    expect(new Set(OCCASIONS.map((o) => o.id)).size).toBe(OCCASIONS.length);
  });
});

describe("search", () => {
  it("maps every way of saying mother to Mother's Day", () => {
    for (const q of ["maa", "mom", "mummy", "amma", "mother", "Mother's Day", "माँ"]) expect(ids(q)).toContain("mothers-day-letter");
  });
  it("understands Indian occasions and relationships", () => {
    expect(ids("rakhi")[0]).toBe("raksha-bandhan-bond");
    expect(ids("bhaiya")).toContain("raksha-bandhan-bond");
    expect(ids("deepavali")).toContain("diwali-wishes");
    expect(ids("papa")[0]).toBe("fathers-day-note");
  });
  it("finds the girlfriend template the product started from", () => {
    expect(ids("girlfriend")).toContain("girlfriends-day-love");
    expect(ids("gf")).toContain("girlfriends-day-love");
    expect(ids("valentine")).toContain("girlfriends-day-love");
  });
  it("finds festivals, life events and trends by the words people use", () => {
    expect(ids("garba")).toContain("navratri-nine-nights");
    expect(ids("karva chauth")).toContain("karwa-chauth-promise");
    expect(ids("sagai")).toContain("engagement-we-said-yes");
    expect(ids("griha pravesh")).toContain("housewarming-invite");
    expect(ids("all the best")).toContain("good-luck-you-got-this");
    expect(ids("wrapped")).toContain("our-wrapped");
    expect(ids("photo dump")).toContain("photo-dump-of-the-year");
    expect(ids("trending").length).toBeGreaterThanOrEqual(12);
  });
  it("forgives typos", () => {
    expect(ids("birthdya")).toContain("birthday-countdown");
    expect(ids("anniversery")).toContain("anniversary-letter");
    expect(ids("teachar")).toContain("teachers-day-thanks");
  });
  it("is case, accent and punctuation insensitive", () => {
    expect(normalize("  Father’s   DAY! ")).toBe("fathers day");
    expect(ids("FATHER'S DAY")).toContain("fathers-day-note");
  });
  it("returns everything for an empty query", () => {
    expect(searchTemplates("", templates).results).toHaveLength(templates.length);
    expect(searchTemplates("   ", templates).results).toHaveLength(templates.length);
  });
  it("returns nothing for gibberish, with related occasions to offer", () => {
    const r = searchTemplates("xyzzyq", templates);
    expect(r.results).toHaveLength(0);
    expect(r.related.length).toBeGreaterThan(0);
  });
  it("resolves an occasion even when no template exists for it yet", () => {
    const r = searchTemplates("holi", []);
    expect(r.occasion?.id).toBe("holi");
    expect(r.results).toHaveLength(0);
  });
  it("suggests while typing", () => {
    expect(suggest("moth")[0]?.id).toBe("mothers-day");
    expect(suggest("")).toEqual([]);
    expect(suggest("raks").map((o) => o.id)).toContain("raksha-bandhan");
  });
  it("measures edit distance", () => {
    expect(distance("kitten", "sitting", 5)).toBe(3);
    expect(distance("same", "same")).toBe(0);
    expect(distance("birthdya", "birthday")).toBe(1);
  });
});
