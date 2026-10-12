/** Fixed UI words the renderer itself shows. Moves into @madeforyou/i18n later. */
const LABELS: Record<string, Record<string, string>> = {
  en: {
    days: "days", hours: "hours", minutes: "minutes", seconds: "seconds", pickDate: "Pick a date",
    years: "years", months: "months", daysOfUs: "days of us", tapToFlip: "Tap to flip", reveal: "Reveal it", tapReveal: "Tap to reveal",
    openIt: "Tap to open", close: "Close", score: "Your score", again: "Play again", moves: "moves", sure: "Are you sure?", reallySure: "Really?",
    addToCalendar: "Add to calendar", openMaps: "Open in Maps", play: "Play video", next: "Next", startsIn: "Starts in",
  },
  hi: {
    days: "दिन", hours: "घंटे", minutes: "मिनट", seconds: "सेकंड", pickDate: "तारीख चुनें",
    years: "साल", months: "महीने", daysOfUs: "दिन साथ", tapToFlip: "पलटने के लिए छुएँ", reveal: "खोलें", tapReveal: "देखने के लिए छुएँ",
    openIt: "खोलने के लिए छुएँ", close: "बंद करें", score: "आपका स्कोर", again: "फिर खेलें", moves: "चालें", sure: "पक्का?", reallySure: "सच में?",
    addToCalendar: "कैलेंडर में जोड़ें", openMaps: "मैप में खोलें", play: "वीडियो चलाएँ", next: "आगे", startsIn: "शुरू होने में",
  },
};
export const label = (lang: string, key: string): string =>
  LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key;
