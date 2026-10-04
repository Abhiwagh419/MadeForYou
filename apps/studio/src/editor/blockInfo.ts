import type { IconName } from "../ui/Icon";

export const BLOCK_INFO: Record<string, { icon: IconName; desc: string }> = {
  hero: { icon: "image", desc: "The cover: a headline, their name and a photo in a frame" },
  text: { icon: "type", desc: "A heading and a few paragraphs of your own words" },
  letter: { icon: "pencil", desc: "A handwritten-style letter on paper" },
  gallery: { icon: "grid", desc: "Photos as a grid, carousel, polaroids or masonry" },
  countdown: { icon: "clock", desc: "A live countdown to a date that matters" },
  signature: { icon: "heart", desc: "Sign off with your name" },
};
