import type { Template } from "@madeforyou/schema";
import { block, tpl } from "./build";

const sign = (message = "With love,") => block("signature", { fields: { message, name: "Your name" }, style: { anim: "fade" } });

/** The launch library, built from the same blocks users get. Grows to 30-50 templates by the beta. */
export const built: Template[] = [
  tpl({
    id: "fathers-day-note", abbr: "fday", title: "A note for Papa",
    occasions: ["fathers-day"], relationships: ["father"], moods: ["emotional"],
    tags: ["papa", "dad", "daddy", "baba", "appa", "pitaji", "father"],
    theme: "marigold-sun", opening: "Open for Papa", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Father's Day", recipient: "Papa", subtitle: "For all the things you never asked thanks for" } }),
      block("text", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        heading: "Things I noticed",
        body: "He never says much, but he is the one who waits up until you are home.\n\nWrite the small things: the lunch he packed, the advice he repeated, the way he said \"it will be fine\" and made it true.",
      } }),
      block("gallery", { fields: { layout: "grid" } }),
      sign("Your child,"),
    ],
  }),
  tpl({
    id: "girlfriends-day-love", abbr: "gfday", title: "For my favourite person",
    occasions: ["girlfriends-day", "valentines"], relationships: ["partner"], moods: ["romantic"],
    tags: ["girlfriend", "gf", "love", "partner", "valentine", "pyaar", "her"],
    theme: "rose-garden", opening: "Tap to open, it is for you", ambience: "petals", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "For my favourite person", recipient: "Her name", subtitle: "Because every day with you is the good kind" } }),
      block("daysTogether", { style: { bg: "soft", anim: "zoom" }, fields: { label: "Together for" } }),
      block("letter", { style: { align: "left", anim: "fade-up" }, fields: {
        salutation: "My love,", closing: "Yours, always,", paper: "ruled",
        body: "Tell her what you noticed first.\n\nThen tell her what you notice now, the small things nobody else would catch, and why they are the reason you smile at your phone.",
      } }),
      block("reasons", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Reasons I love you", style: "flip" } }),
      block("gallery", { fields: { layout: "polaroid" } }),
      sign("Yours,"),
    ],
  }),
  tpl({
    id: "anniversary-letter", abbr: "anniv", title: "Our story, a letter",
    occasions: ["anniversary"], relationships: ["partner", "spouse"], moods: ["romantic", "emotional"],
    tags: ["anniversary", "years together", "wedding anniversary", "husband", "wife"],
    theme: "rose-garden", opening: "A letter for you", ambience: "petals", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Anniversary", recipient: "My love", subtitle: "Still choosing you, every single day" } }),
      block("daysTogether", { style: { bg: "soft", anim: "zoom" }, fields: { label: "Together for" } }),
      block("timeline", { style: { anim: "fade-up" }, fields: { title: "Our story" } }),
      block("divider", { fields: { style: "floral" }, style: { space: "sm" } }),
      block("featured", { fields: { frame: "ornate", caption: "Still the best day" } }),
      block("video", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "A video for you" } }),
      block("letter", { style: { align: "left", anim: "fade-up" }, fields: { salutation: "To my favourite person,", closing: "Forever yours,", paper: "cream" } }),
      sign("Forever,"),
    ],
  }),
  tpl({
    id: "friendship-day-yaar", abbr: "fship", title: "For my partner in chaos",
    occasions: ["friendship-day"], relationships: ["friend"], moods: ["funny", "festive"],
    tags: ["friend", "bestie", "bff", "yaar", "dost", "best friend"],
    theme: "marigold-sun", opening: "Open, bestie", ambience: "confetti", tap: "sparkles",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Friendship Day", recipient: "Yaar", subtitle: "Partner in every plan that went wrong" } }),
      block("text", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        heading: "Our greatest hits",
        body: "The trip that went nowhere. The exam night. The inside joke nobody else gets.\n\nList the moments that only the two of you would laugh at.",
      } }),
      block("quiz", { style: { anim: "fade-up" }, fields: { title: "How well do you know me?" } }),
      block("memory", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Match our memories" } }),
      block("gallery", { fields: { layout: "masonry" } }),
      sign("Your yaar,"),
    ],
  }),
  tpl({
    id: "teachers-day-thanks", abbr: "tday", title: "Thank you, teacher",
    occasions: ["teachers-day", "thank-you"], relationships: ["teacher"], moods: ["emotional"],
    tags: ["teacher", "guru", "sir", "madam", "mam", "mentor", "professor"],
    theme: "rose-garden", opening: "A thank-you note", tap: "none",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Thank you, teacher", recipient: "Sir / Ma'am", subtitle: "For lessons that outlasted the syllabus" } }),
      block("letter", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        salutation: "Dear Sir / Ma'am,", closing: "Your student,", paper: "plain",
        body: "Think of one thing they taught you that was not in any textbook.\n\nTell them where it took you.",
      } }),
      sign("With gratitude,"),
    ],
  }),
  tpl({
    id: "raksha-bandhan-bond", abbr: "rakhi", title: "Rakhi surprise for Bhaiya", titleHi: "भैया के लिए राखी सरप्राइज़",
    occasions: ["raksha-bandhan"], relationships: ["brother", "sister"], moods: ["festive", "emotional"],
    tags: ["rakhi", "bhai", "bhaiya", "behen", "sister", "brother", "sibling"],
    theme: "marigold-sun", opening: "Rakhi surprise", ambience: "confetti", tap: "sparkles",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Raksha Bandhan", recipient: "Bhaiya", subtitle: "The one who always has my back" },
        hi: { title: "रक्षा बंधन की शुभकामनाएँ", recipient: "भैया", subtitle: "जो हमेशा मेरे साथ खड़ा रहा" } }),
      block("divider", { fields: { style: "rangoli" }, style: { space: "sm" } }),
      block("countdown", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Until Rakhi", endMessage: "It's Rakhi today!" } }),
      block("letter", { style: { align: "left", anim: "fade-up" }, fields: {
        salutation: "Dear Bhaiya,", closing: "Your sister,", paper: "cream",
        body: "Remember the fights over the remote, and the time you took the blame for me?\n\nSay it now, while the rakhi is still in your hand.",
      }, hi: { salutation: "प्रिय भैया," } }),
      block("checklist", { style: { anim: "fade-up" }, fields: { title: "Things I promise you, bhai", style: "promises" } }),
      block("gallery", { style: { bg: "soft" }, fields: { layout: "polaroid" } }),
      sign("Always,"),
    ],
  }),
  tpl({
    id: "diwali-wishes", abbr: "diwali", title: "Diwali wishes", titleHi: "दिवाली की शुभकामनाएँ",
    occasions: ["diwali"], relationships: ["family", "friend"], moods: ["festive"],
    tags: ["diwali", "deepavali", "diya", "festival of lights", "family"],
    theme: "marigold-sun", opening: "Light a diya", ambience: "diyas", tap: "sparkles",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Diwali", recipient: "Dear family", subtitle: "May your home glow all year" },
        hi: { title: "दीपावली की शुभकामनाएँ", recipient: "प्रिय परिवार", subtitle: "आपका घर साल भर रोशन रहे" } }),
      block("divider", { fields: { style: "rangoli" }, style: { space: "sm" } }),
      block("text", { style: { bg: "soft", anim: "fade-up" }, fields: {
        heading: "My wish for you",
        body: "Write one wish for each person, not a forwarded message.\n\nMake it specific. Make it yours.",
      } }),
      block("quote", { style: { anim: "fade-up" }, fields: { text: "Diye ki roshni se ghar ka andhera mite,\nAapke saath har khushi aapke ghar mein rahe.", author: "With every good wish" } }),
      block("gallery", { style: { bg: "soft" }, fields: { layout: "grid" } }),
      sign("With love,"),
    ],
  }),
  tpl({
    id: "farewell-colleague", abbr: "fwell", title: "One last message",
    occasions: ["farewell"], relationships: ["colleague"], moods: ["emotional"],
    tags: ["farewell", "goodbye", "colleague", "retirement", "last day", "send off", "team"],
    theme: "rose-garden", opening: "One last message", tap: "none",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "We'll miss you", recipient: "Their name", subtitle: "Thank you for everything you built here" } }),
      block("text", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        heading: "What you leave behind",
        body: "The jokes, the late-night saves, the way you made hard weeks lighter.\n\nName one thing the team will keep doing because of them.",
      } }),
      block("reasons", { style: { anim: "fade-up" }, fields: { title: "Things we will miss", style: "cards" } }),
      block("wishes", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Messages from the team", prompt: "Leave a message for them", moderation: "review" } }),
      block("gallery", { style: { bg: "soft" }, fields: { layout: "carousel" } }),
      block("letter", { style: { align: "left", anim: "fade-up" }, fields: { salutation: "Dear friend,", closing: "Stay in touch,", paper: "plain" } }),
      sign("From all of us,"),
    ],
  }),
  tpl({
    id: "thank-you-simple", abbr: "thanks", title: "A simple thank you",
    occasions: ["thank-you"], relationships: ["friend", "family"], moods: ["minimal", "emotional"],
    tags: ["thanks", "gratitude", "shukriya", "dhanyavad", "thank you"],
    theme: "rose-garden", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Thank you", recipient: "Their name", subtitle: "For being there when it mattered" } }),
      block("letter", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        salutation: "Dear you,", closing: "With thanks,", paper: "cream",
        body: "Say exactly what they did, and exactly what it meant.\n\nThe specific thank-yous are the ones people keep.",
      } }),
      sign("Gratefully,"),
    ],
  }),
  tpl({
    id: "sorry-from-heart", abbr: "sorry", title: "I'm sorry, and I mean it",
    occasions: ["sorry"], relationships: ["partner", "friend", "family"], moods: ["emotional", "minimal"],
    tags: ["sorry", "apology", "maafi", "maaf", "forgive", "apologize"],
    theme: "midnight-stars", opening: "Please read this", ambience: "stars", tap: "none",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "I'm sorry", recipient: "Their name", subtitle: "And I mean it" } }),
      block("letter", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        salutation: "Dear you,", closing: "Hoping you'll hear me out,", paper: "plain",
        body: "Say what you did, without excuses.\n\nSay how you think it felt on their side. Then say what you will do differently.",
      } }),
      sign("Sincerely,"),
    ],
  }),

  tpl({
    id: "wedding-invite", abbr: "wedding", title: "A wedding invitation", titleHi: "शादी का निमंत्रण",
    occasions: ["wedding"], relationships: ["family", "friend"], moods: ["festive", "romantic"],
    tags: ["wedding", "shaadi", "invitation", "invite", "vivah", "engagement", "sagai", "rsvp"],
    theme: "marigold-sun", opening: "Open your invitation", ambience: "diyas", tap: "sparkles",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "You are invited", recipient: "Dear guest", subtitle: "To celebrate our wedding" },
        hi: { title: "आप आमंत्रित हैं", recipient: "प्रिय अतिथि", subtitle: "हमारे विवाह समारोह में" } }),
      block("divider", { fields: { style: "rangoli" }, style: { space: "sm" } }),
      block("event", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "The wedding" } }),
      block("map", { style: { anim: "fade-up" }, fields: { title: "How to find us", note: "Parking is available at the venue" } }),
      block("text", { style: { align: "left", anim: "fade-up" }, fields: {
        heading: "Our story",
        body: "How did you two meet, and when did you know?\n\nA few warm lines are all your guests need.",
      } }),
      block("featured", { style: { bg: "soft" }, fields: { frame: "ornate", caption: "Together" } }),
      block("rsvp", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Will you join us?", deadline: "Please reply by 1 February" } }),
      block("buttons", { style: { anim: "fade-up" }, fields: { layout: "stack" } }),
      sign("With love, and both our families,"),
    ],
  }),
  tpl({
    id: "proposal-ask", abbr: "propose", title: "I have something to ask",
    occasions: ["valentines", "girlfriends-day", "boyfriends-day"], relationships: ["partner"], moods: ["romantic"],
    tags: ["propose", "proposal", "ask", "will you", "love", "valentine", "crush", "girlfriend", "boyfriend"],
    theme: "rose-garden", opening: "Open, I have a question", ambience: "petals", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "I have something to ask", recipient: "Her name", subtitle: "Please read to the end" } }),
      block("text", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: {
        heading: "Before I ask",
        body: "Tell them what you have noticed, what you have been too shy to say, and why today.\n\nKeep it honest and short.",
      } }),
      block("featured", { fields: { frame: "polaroid", caption: "My favourite day" } }),
      block("ask", { style: { bg: "soft", space: "lg" }, fields: {} }),
      sign("Yours,"),
    ],
  }),
  tpl({
    id: "open-when-letters", abbr: "openw", title: "Open when letters",
    occasions: ["valentines", "anniversary", "girlfriends-day"], relationships: ["partner", "friend"], moods: ["romantic", "emotional"],
    tags: ["open when", "letters", "miss you", "long distance", "sad", "surprise"],
    theme: "rose-garden", opening: "Open when you are ready", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Open when…", recipient: "Her name", subtitle: "A letter for every kind of day" } }),
      block("openWhen", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Choose a day" } }),
      block("quote", { fields: { text: "Wherever you are,\nyou are home to me.", author: "Always" } }),
      sign("Yours,"),
    ],
  }),
  tpl({
    id: "get-well-soon", abbr: "getwell", title: "Get well soon",
    occasions: ["get-well"], relationships: ["friend", "family"], moods: ["emotional", "minimal"],
    tags: ["get well", "recovery", "sick", "health", "speedy recovery", "hospital"],
    theme: "rose-garden", opening: "A little cheer for you", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Get well soon", recipient: "Their name", subtitle: "Rest. We are all thinking of you" } }),
      block("quote", { style: { bg: "soft", anim: "fade-up" }, fields: { text: "This too shall pass,\nand we will laugh about it soon.", author: "Thinking of you" } }),
      block("checklist", { fields: { title: "When you are better, we will…", style: "bucket" } }),
      sign("Get well soon,"),
    ],
  }),
  tpl({
    id: "congratulations-party", abbr: "congrats", title: "Congratulations!",
    occasions: ["congratulations", "graduation"], relationships: ["friend", "family"], moods: ["festive", "funny"],
    tags: ["congrats", "congratulations", "well done", "promotion", "new job", "graduation", "result", "badhai"],
    theme: "marigold-sun", opening: "You did it", ambience: "confetti", tap: "sparkles",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Congratulations", recipient: "Their name", subtitle: "We always knew you would" } }),
      block("reveal", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Something for you", style: "scratch" } }),
      block("timeline", { style: { anim: "fade-up" }, fields: { title: "The road here" } }),
      block("gallery", { style: { bg: "soft" }, fields: { layout: "grid" } }),
      sign("Proud of you,"),
    ],
  }),

  tpl({
    id: "birthday-wishes-wall", abbr: "bdwall", title: "Birthday page with a wishes wall",
    occasions: ["birthday"], relationships: ["friend", "partner", "family"], moods: ["festive", "emotional"],
    tags: ["birthday", "bday", "wishes", "surprise", "friends", "messages", "collect wishes"],
    theme: "marigold-sun", opening: "Happy birthday!", ambience: "confetti", tap: "sparkles",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Birthday", recipient: "Their name", subtitle: "Everyone who loves you is here" } }),
      block("wishes", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Wishes from everyone who loves you", prompt: "Leave a birthday wish", moderation: "review" } }),
      block("voiceNote", { style: { anim: "fade-up" }, fields: { title: "A message in my voice" } }),
      block("gallery", { style: { bg: "soft" }, fields: { layout: "polaroid" } }),
      block("replyBox", { style: { anim: "fade-up" }, fields: { title: "Say thank you", prompt: "Write back to me" } }),
      sign("With love,"),
    ],
  }),
  tpl({
    id: "voice-note-for-maa", abbr: "voicema", title: "A voice note for Maa", titleHi: "माँ के लिए एक वॉइस नोट",
    occasions: ["mothers-day"], relationships: ["mother"], moods: ["emotional"],
    tags: ["maa", "mom", "mummy", "amma", "aai", "mother", "voice", "voice note", "audio"],
    theme: "rose-garden", opening: "Press play, Maa", ambience: "petals", tap: "hearts",
    blocks: [
      block("hero", { final: ["title"], fields: { title: "Happy Mother's Day", recipient: "Maa", subtitle: "Listen with headphones" },
        hi: { title: "मातृ दिवस की शुभकामनाएँ", recipient: "माँ", subtitle: "हेडफ़ोन लगाकर सुनिए" } }),
      block("voiceNote", { style: { bg: "soft", anim: "zoom" }, fields: { title: "A message in my voice", caption: "Press play" } }),
      block("letter", { style: { align: "left", anim: "fade-up" }, fields: { salutation: "Dear Maa,", closing: "Your child,", paper: "cream" }, hi: { salutation: "प्रिय माँ," } }),
      block("replyBox", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Write back to me", prompt: "Tell me how you felt" } }),
      sign("With love,"),
    ],
  }),
];
