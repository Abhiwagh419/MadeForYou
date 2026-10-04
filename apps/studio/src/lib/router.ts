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
  return () => window.removeEventListener("hashchange", cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return useMemo(() => parseHash(hash), [hash]);
}

export const go = (path: string) => {
  window.location.hash = path;
};
export const href = (path: string) => `#${path}`;
