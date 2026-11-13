/** Fixed UI words the renderer itself shows. Moves into @madeforyou/i18n later. */
const LABELS: Record<string, Record<string, string>> = {
  en: {
    days: "days", hours: "hours", minutes: "minutes", seconds: "seconds", pickDate: "Pick a date",
    years: "years", months: "months", daysOfUs: "days of us", tapToFlip: "Tap to flip", reveal: "Reveal it", tapReveal: "Tap to reveal",
    openIt: "Tap to open", close: "Close", score: "Your score", again: "Play again", moves: "moves", sure: "Are you sure?", reallySure: "Really?",
    addToCalendar: "Add to calendar", openMaps: "Open in Maps", play: "Play video", next: "Next", startsIn: "Starts in",
    yourName: "Your name", yourWish: "Your wish", yourMessage: "Your message", yourNote: "A note (optional)", send: "Send", sending: "Sending…",
    wishPending: "Thank you! Your wish will appear once it has been approved.", wishDone: "Thank you! Your wish is on the wall.",
    replyDone: "Sent.", yes: "Yes", no: "No", maybe: "Maybe", guests: "How many of you?", livePreview: "Guests can leave messages once the page is live.",
    loadMap: "Tap to load the map", playNote: "Play voice note", pauseNote: "Pause",
    remindMe: "Email me a reminder (optional)", remindHint: "One email, a day before. Only the person who made this page can see your address.",
  },
  hi: {
    days: "दिन", hours: "घंटे", minutes: "मिनट", seconds: "सेकंड", pickDate: "तारीख चुनें",
    years: "साल", months: "महीने", daysOfUs: "दिन साथ", tapToFlip: "पलटने के लिए छुएँ", reveal: "खोलें", tapReveal: "देखने के लिए छुएँ",
    openIt: "खोलने के लिए छुएँ", close: "बंद करें", score: "आपका स्कोर", again: "फिर खेलें", moves: "चालें", sure: "पक्का?", reallySure: "सच में?",
    addToCalendar: "कैलेंडर में जोड़ें", openMaps: "मैप में खोलें", play: "वीडियो चलाएँ", next: "आगे", startsIn: "शुरू होने में",
    yourName: "आपका नाम", yourWish: "आपकी शुभकामना", yourMessage: "आपका संदेश", yourNote: "कोई संदेश (वैकल्पिक)", send: "भेजें", sending: "भेज रहे हैं…",
    wishPending: "धन्यवाद! मंज़ूरी मिलने पर आपकी शुभकामना दिखेगी।", wishDone: "धन्यवाद! आपकी शुभकामना दीवार पर है।",
    replyDone: "भेज दिया।", yes: "हाँ", no: "नहीं", maybe: "शायद", guests: "आप कितने लोग हैं?", livePreview: "पेज लाइव होने पर मेहमान संदेश छोड़ सकेंगे।",
    loadMap: "मैप खोलने के लिए छुएँ", playNote: "वॉइस नोट चलाएँ", pauseNote: "रोकें",
    remindMe: "मुझे ईमेल से याद दिलाएँ (वैकल्पिक)", remindHint: "सिर्फ़ एक ईमेल, एक दिन पहले। आपका पता सिर्फ़ पेज बनाने वाले को दिखेगा।",
  },
};
export const label = (lang: string, key: string): string =>
  LABELS[lang]?.[key] ?? LABELS.en?.[key] ?? key;
