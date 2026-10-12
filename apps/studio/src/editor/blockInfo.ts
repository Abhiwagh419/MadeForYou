import type { IconName } from "../ui/Icon";

export const BLOCK_INFO: Record<string, { icon: IconName; desc: string }> = {
  hero: { icon: "image", desc: "The cover: a headline, their name and a photo in a frame" },
  featured: { icon: "image", desc: "One photo you love, as a polaroid, taped print or framed" },
  gallery: { icon: "grid", desc: "Photos as a grid, carousel, polaroids or masonry" },
  timeline: { icon: "clock", desc: "Your story as moments along a line" },
  daysTogether: { icon: "heart", desc: "How long you have been together, counted live" },
  video: { icon: "video", desc: "A YouTube or Vimeo video that plays when tapped" },
  text: { icon: "type", desc: "A heading and a few paragraphs of your own words" },
  letter: { icon: "pencil", desc: "A handwritten-style letter on paper" },
  quote: { icon: "quote", desc: "A shayari or quote, beautifully set" },
  reasons: { icon: "list", desc: "Reasons you love them, as cards or tap-to-flip" },
  checklist: { icon: "check", desc: "Promises, or a bucket list for the two of you" },
  openWhen: { icon: "mail", desc: "Sealed letters to open when they miss you, or need a smile" },
  countdown: { icon: "clock", desc: "A live countdown to a date that matters" },
  reveal: { icon: "sparkle", desc: "A scratch card that hides a message" },
  ask: { icon: "question", desc: "A question with a Yes, and a No that runs away" },
  quiz: { icon: "star", desc: "How well do they know you? Questions with a score" },
  memory: { icon: "sparkle", desc: "A matching game made from your photos" },
  event: { icon: "calendar", desc: "Date, time and place, with add-to-calendar" },
  buttons: { icon: "link", desc: "WhatsApp, call, email or any link, as buttons" },
  divider: { icon: "minus", desc: "A decorative break between sections" },
  signature: { icon: "heart", desc: "Sign off with your name" },
};

export const CATEGORY_LABELS: Record<string, string> = {
  opening: "Cover",
  memories: "Photos and memories",
  words: "Words",
  interactive: "Games and surprises",
  utility: "Details and links",
};
