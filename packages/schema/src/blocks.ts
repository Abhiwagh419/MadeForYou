import { f, type FieldDef } from "./fields";

export interface BlockDef {
  type: string;
  version: number;
  category: "opening" | "memories" | "words" | "interactive" | "social" | "utility";
  label: string;
  fields: Record<string, FieldDef>;
}

/**
 * Starter set: 6 of the 26 planned blocks. Add the rest by adding an entry here
 * and a component in the renderer. Nothing else needs to change.
 */
export const hero: BlockDef = {
  type: "hero",
  version: 1,
  category: "opening",
  label: "Hero / Cover",
  fields: {
    recipient: f.text(60, {
      personal: true, guided: true, required: true,
      prompt: "Who is this made for?", placeholder: "Their name",
    }),
    title: f.text(80, {
      personal: true, guided: true, required: true,
      prompt: "What should the headline say?", placeholder: "A page made for you",
    }),
    subtitle: f.text(140, {
      personal: true, guided: true,
      prompt: "Add a short line under it", placeholder: "Written with love, just for you",
    }),
    cover: f.image({ personal: true, guided: true, prompt: "Choose a cover photo" }),
    layout: f.enum(["centered", "split", "fullbleed"], "centered"),
  },
};

export const text: BlockDef = {
  type: "text",
  version: 1,
  category: "words",
  label: "Heading and text",
  fields: {
    heading: f.text(100, {
      personal: true, guided: true,
      prompt: "Add a heading", placeholder: "Something I want you to know",
    }),
    body: f.longtext(2000, {
      personal: true, guided: true,
      prompt: "Write your message",
      placeholder: "Write what you feel, in your own words. A few honest lines are better than a perfect paragraph.",
    }),
  },
};

export const letter: BlockDef = {
  type: "letter",
  version: 1,
  category: "words",
  label: "Letter",
  fields: {
    salutation: f.text(80, {
      personal: true, guided: true,
      prompt: "Who is the letter to?", placeholder: "Dear you,",
    }),
    body: f.longtext(5000, {
      personal: true, guided: true, required: true,
      prompt: "Write your letter",
      placeholder: "Start with a memory that makes you smile, then say the thing you have never said out loud.",
    }),
    closing: f.text(80, {
      personal: true, guided: true,
      prompt: "How does your letter end?", placeholder: "With all my love,",
    }),
    paper: f.enum(["cream", "plain", "ruled"], "cream"),
  },
};

export const gallery: BlockDef = {
  type: "gallery",
  version: 1,
  category: "memories",
  label: "Photo gallery",
  fields: {
    layout: f.enum(["grid", "carousel", "polaroid", "masonry"], "grid"),
    items: f.list(
      12,
      {
        image: f.image({ personal: true }),
        caption: f.text(120, { personal: true, prompt: "Add a caption (optional)" }),
      },
      { personal: true, guided: true, required: true, prompt: "Upload your favourite photos", placeholder: [] },
    ),
  },
};

export const countdown: BlockDef = {
  type: "countdown",
  version: 1,
  category: "interactive",
  label: "Countdown",
  fields: {
    title: f.text(80, {
      personal: true, guided: true,
      prompt: "What are you counting down to?", placeholder: "Until we meet",
    }),
    target: f.date({
      personal: true, guided: true, required: true, prompt: "When is it?",
    }),
    endMessage: f.text(140, {
      personal: true, guided: true,
      prompt: "What should it say when the day arrives?", placeholder: "It's today!",
    }),
  },
};

export const signature: BlockDef = {
  type: "signature",
  version: 1,
  category: "utility",
  label: "Signature",
  fields: {
    message: f.text(100, {
      personal: true, guided: true,
      prompt: "Add a last line above your name", placeholder: "With love,",
    }),
    name: f.text(60, {
      personal: true, guided: true, required: true,
      prompt: "Your name", placeholder: "Your name",
    }),
  },
};
