import { useSyncExternalStore } from "react";
import { supportUpi } from "./config";

/**
 * The pop-up that explains MadeForYou runs on limited resources and asks for help.
 * It appears at two moments: once after a first publish, and after someone downloads the story picture or the QR code.
 * It never appears twice for downloads within a day, so it stays a favour and not a nag.
 * It needs the support page to be switched on, otherwise there is nothing to ask for.
 */
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
  } catch {
    /* storage blocked: the note may show again, which is harmless */
  }
};

/** Whether this moment should show the note, given what this device has already seen. Pure, so it is easy to test. */
export function shouldAsk(moment: HelpMoment, seen: Seen, now: number): boolean {
  if (moment === "publish") return !seen.publish;
  return !seen.export || now - seen.export > DAY;
}

let current: HelpMoment | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

/** Call right after a publish or a download. Does nothing when the note was shown recently or support is off. */
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
