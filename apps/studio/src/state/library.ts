import { useEffect, useMemo, useState } from "react";
import type { Template } from "@madeforyou/schema";
import { templates as builtIn } from "@madeforyou/templates";
import { isRemote } from "../lib/config";
import { fetchPublicTemplates } from "../lib/sync";
import { useStore } from "./store";

export function useAllTemplates(): { all: Template[]; mineIds: Set<string> } {
  const mineMap = useStore((s) => s.templates);
  const [remote, setRemote] = useState<Template[]>([]);

  useEffect(() => {
    if (!isRemote()) return;
    let alive = true;
    fetchPublicTemplates().then((t) => alive && setRemote(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    const mine = Object.values(mineMap).map((r) => r.template);
    const seen = new Set([...mine.map((t) => t.meta.id), ...builtIn.map((t) => t.meta.id)]);
    const others = remote.filter((t) => !seen.has(t.meta.id));
    return { all: [...mine, ...others, ...builtIn], mineIds: new Set(mine.map((t) => t.meta.id)) };
  }, [mineMap, remote]);
}
