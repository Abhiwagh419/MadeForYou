import { useMemo, useSyncExternalStore } from "react";

export interface Route {
  name: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

const TABLE: [string, RegExp, string[]][] = [
  ["home", /^\/?$/, []],
  ["templates", /^\/templates\/?$/, []],
  ["template", /^\/t\/([\w-]+)\/?$/, ["id"]],
  ["make", /^\/make\/([\w-]+)\/?$/, ["id"]],
  ["edit", /^\/edit\/([\w-]+)\/?$/, ["id"]],
  ["publish", /^\/publish\/([\w-]+)\/?$/, ["id"]],
  ["share", /^\/share\/([\w-]+)\/?$/, ["id"]],
  ["astemplate", /^\/template-from\/([\w-]+)\/?$/, ["id"]],
  ["me", /^\/me\/?$/, []],
  ["status", /^\/status\/?$/, []],
  ["inbox", /^\/inbox\/([\w-]+)\/?$/, ["id"]],
  ["view", /^\/p\/([\w-]+)\/?$/, ["slug"]],
];

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [path = "/", qs = ""] = raw.split("?");
  for (const [name, re, keys] of TABLE) {
    const m = path.match(re);
    if (m) return { name, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1] ?? ""])), query: new URLSearchParams(qs) };
  }
  return { name: "notfound", params: {}, query: new URLSearchParams(qs) };
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
};

/** Visitor links are real paths (/p/priya) so the server can add a link preview; the studio uses #/ routes. */
export function parseLocation(pathname: string, hash: string, search = ""): Route {
  const m = pathname.match(/^\/p\/([\w-]+)\/?$/);
  if (m) return { name: "view", params: { slug: m[1]! }, query: new URLSearchParams() };
  const c = pathname.match(/^\/c\/([\w-]+)\/?$/);
  if (c) return { name: "contribute", params: { slug: c[1]! }, query: new URLSearchParams(search) };
  return parseHash(hash);
}

export function useRoute(): Route {
  const key = useSyncExternalStore(subscribe, () => `${window.location.pathname}|${window.location.hash}|${window.location.search}`, () => "");
  return useMemo(() => {
    const [path = "/", hash = "", search = ""] = key.split("|");
    return parseLocation(path, hash, search);
  }, [key]);
}

export const go = (path: string) => {
  window.location.hash = path;
};
export const href = (path: string) => `#${path}`;
