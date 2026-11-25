import { useSyncExternalStore } from "react";
import { supportUpi } from "./config";

export type HelpMoment = "publish" | "export";

const KEY = "mfy:help-note";
const DAY = 86_400_000;

interface Seen { publish?: number; export?: number }
const read = (): Seen => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Seen;
  } catch {
    return {};
  }
};
const write = (s: Seen) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};

export function shouldAsk(moment: HelpMoment, seen: Seen, now: number): boolean {
  if (moment === "publish") return true;
  return !seen.export || now - seen.export > DAY;
}

let current: HelpMoment | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function askForHelp(moment: HelpMoment, now = Date.now()) {
  if (!supportUpi() || current) return;
  const seen = read();
  if (!shouldAsk(moment, seen, now)) return;
  write({ ...seen, [moment]: now });
  current = moment;
  emit();
}
export const closeHelpNote = () => {
  current = null;
  emit();
};
export const useHelpNote = () => useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => current, () => current);
