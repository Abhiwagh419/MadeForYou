/** Fixed UI words the renderer itself shows. Moves into @madeforyou/i18n later. */
const LABELS: Record<string, Record<string, string>> = {
  en: { days: "days", hours: "hours", minutes: "minutes", seconds: "seconds", pickDate: "Pick a date" },
  hi: { days: "दिन", hours: "घंटे", minutes: "मिनट", seconds: "सेकंड", pickDate: "तारीख चुनें" },
};
export const label = (lang: string, key: string): string =>
  LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key;
