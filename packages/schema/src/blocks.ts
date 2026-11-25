import { f, type FieldDef } from "./fields";

export interface BlockDef {
  type: string;
  version: number;
  category: "opening" | "memories" | "words" | "interactive" | "social" | "utility";
  label: string;
  fields: Record<string, FieldDef>;
}

export const hero: BlockDef = {
  type: "hero",
  version: 1,
  category: "opening",
  label: "Hero / Cover",
  fields: {
    recipient: f.text(60, {
      personal: true, guided: true, required: true, nameLike: true,
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
      personal: true, guided: true, nameLike: true,
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
      personal: true, guided: true, required: true, nameLike: true,
      prompt: "Your name", placeholder: "Your name",
    }),
  },
};

export const featured: BlockDef = {
  type: "featured", version: 1, category: "memories", label: "Featured photo",
  fields: {
    image: f.image({ personal: true, guided: true, required: true, prompt: "Choose a photo you love" }),
    caption: f.text(140, { personal: true, guided: true, prompt: "Add a caption", placeholder: "The day I knew" }),
    frame: f.enum(["polaroid", "tape", "ornate", "plain"], "polaroid"),
  },
};

export const timeline: BlockDef = {
  type: "timeline", version: 1, category: "memories", label: "Timeline",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name your story", placeholder: "Our story" }),
    items: f.list(
      12,
      {
        date: f.text(30, { personal: true, prompt: "When?" }),
        title: f.text(60, { personal: true, prompt: "What happened?" }),
        text: f.longtext(400, { personal: true, prompt: "Tell the story" }),
        image: f.image({ personal: true }),
      },
      {
        personal: true, guided: true, required: true, prompt: "Add the moments of your story",
        placeholder: [
          { date: "The first hello", title: "How we met", text: "Where were you, and who spoke first?" },
          { date: "The first trip", title: "A day we still talk about", text: "What made it unforgettable?" },
          { date: "Today", title: "Still choosing you", text: "What do you love about where you are now?" },
        ],
      },
    ),
  },
};

export const daysTogether: BlockDef = {
  type: "daysTogether", version: 1, category: "memories", label: "Days together",
  fields: {
    label: f.text(60, { personal: true, guided: true, prompt: "What are you counting?", placeholder: "Together for" }),
    since: f.date({ personal: true, guided: true, required: true, prompt: "Since when?" }),
    show: f.enum(["ymd", "days"], "ymd"),
  },
};

export const video: BlockDef = {
  type: "video", version: 1, category: "memories", label: "Video",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Give the video a title", placeholder: "Watch this" }),
    video: f.embed({ personal: true, guided: true, required: true, prompt: "Paste a YouTube or Vimeo link" }),
    caption: f.text(160, { personal: true, prompt: "Add a line about it", placeholder: "I made this for you" }),
  },
};

export const quote: BlockDef = {
  type: "quote", version: 1, category: "words", label: "Quote or shayari",
  fields: {
    text: f.longtext(600, {
      personal: true, guided: true, required: true, prompt: "Write or paste the lines",
      placeholder: "Tum jo mile to laga,\nsab kuch mil gaya.",
    }),
    author: f.text(60, { personal: true, guided: true, prompt: "Who wrote it? (optional)", placeholder: "Written for you" }),
    style: f.enum(["shayari", "quote"], "shayari"),
  },
};

export const reasons: BlockDef = {
  type: "reasons", version: 1, category: "words", label: "Reasons list",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name your list", placeholder: "Reasons I love you" }),
    style: f.enum(["cards", "flip"], "cards"),
    items: f.list(20, { text: f.longtext(200, { personal: true, prompt: "One reason" }) }, {
      personal: true, guided: true, required: true, prompt: "Add your reasons, one at a time",
      placeholder: [
        { text: "The way you laugh at your own jokes" },
        { text: "How you remember the little things" },
        { text: "You make ordinary days feel special" },
      ],
    }),
  },
};

export const checklist: BlockDef = {
  type: "checklist", version: 1, category: "words", label: "Promises or bucket list",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name your list", placeholder: "Things I promise you" }),
    style: f.enum(["promises", "bucket"], "promises"),
    items: f.list(20, { text: f.text(120, { personal: true, prompt: "One item" }) }, {
      personal: true, guided: true, required: true, prompt: "Add your promises, one at a time",
      placeholder: [{ text: "To listen before I answer" }, { text: "To never go to bed angry" }, { text: "To always make time for you" }],
    }),
  },
};

export const openWhen: BlockDef = {
  type: "openWhen", version: 1, category: "words", label: "Open when letters",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name the collection", placeholder: "Open when…" }),
    letters: f.list(
      8,
      {
        label: f.text(50, { personal: true, prompt: "Open when…" }),
        message: f.longtext(800, { personal: true, prompt: "Your message" }),
      },
      {
        personal: true, guided: true, required: true, prompt: "Write your open-when letters",
        placeholder: [
          { label: "Open when you miss me", message: "Close your eyes. I am thinking of you right now, too." },
          { label: "Open when you feel low", message: "You have carried harder days than this. I am so proud of you." },
          { label: "Open when you need a smile", message: "Remember the time we could not stop laughing?" },
        ],
      },
    ),
  },
};

export const reveal: BlockDef = {
  type: "reveal", version: 1, category: "interactive", label: "Scratch card",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "What should it say above the card?", placeholder: "A little surprise" }),
    message: f.longtext(300, { personal: true, guided: true, required: true, prompt: "What is hidden underneath?", placeholder: "I love you more than I can scratch out in words." }),
    hint: f.text(40, { prompt: "Hint on the card", placeholder: "Scratch to reveal" }),
    style: f.enum(["scratch", "tap"], "scratch"),
  },
};

export const ask: BlockDef = {
  type: "ask", version: 1, category: "interactive", label: "The Ask",
  fields: {
    question: f.text(100, { personal: true, guided: true, required: true, prompt: "What do you want to ask?", placeholder: "Will you go out with me?" }),
    yes: f.text(30, { personal: true, prompt: "Yes button", placeholder: "Yes!" }),
    no: f.text(30, { personal: true, prompt: "No button", placeholder: "No" }),
    celebration: f.text(160, { personal: true, guided: true, prompt: "What should it say when they tap Yes?", placeholder: "You just made me the happiest person alive." }),
  },
};

export const quiz: BlockDef = {
  type: "quiz", version: 1, category: "interactive", label: "Quiz",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name your quiz", placeholder: "How well do you know me?" }),
    questions: f.list(
      8,
      {
        question: f.text(140, { personal: true, prompt: "Question" }),
        optionA: f.text(60, { personal: true, prompt: "Option A" }),
        optionB: f.text(60, { personal: true, prompt: "Option B" }),
        optionC: f.text(60, { personal: true, prompt: "Option C" }),
        optionD: f.text(60, { personal: true, prompt: "Option D" }),
        correct: f.enum(["A", "B", "C", "D"], "A"),
      },
      {
        personal: true, guided: true, required: true, prompt: "Write your questions",
        placeholder: [
          { question: "Where did we first meet?", optionA: "A café", optionB: "College", optionC: "A wedding", optionD: "Online", correct: "A" },
          { question: "What is my favourite food?", optionA: "Pizza", optionB: "Biryani", optionC: "Pani puri", optionD: "Pasta", correct: "B" },
        ],
      },
    ),
    resultHigh: f.text(160, { personal: true, prompt: "Message for a great score", placeholder: "You know me better than anyone." }),
    resultMid: f.text(160, { personal: true, prompt: "Message for a middle score", placeholder: "Not bad. We have more to learn about each other." }),
    resultLow: f.text(160, { personal: true, prompt: "Message for a low score", placeholder: "Time for more dates, then." }),
  },
};

export const memory: BlockDef = {
  type: "memory", version: 1, category: "interactive", label: "Memory match",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name the game", placeholder: "Match our memories" }),
    photos: f.list(8, { image: f.image({ personal: true }) }, {
      personal: true, guided: true, prompt: "Add 4 to 8 photos for the game", placeholder: [],
    }),
    winMessage: f.text(140, { personal: true, prompt: "What should it say when they win?", placeholder: "You matched every memory." }),
  },
};

export const event: BlockDef = {
  type: "event", version: 1, category: "utility", label: "Event details",
  fields: {
    title: f.text(80, { personal: true, guided: true, required: true, prompt: "What is the event?", placeholder: "Our celebration" }),
    when: f.date({ personal: true, guided: true, required: true, prompt: "When does it start?" }, true),
    place: f.text(120, { personal: true, guided: true, prompt: "Where is it?", placeholder: "The venue, and the area" }),
    mapsLink: f.url(300, { personal: true, guided: true, prompt: "Paste a Google Maps link (optional)" }),
    note: f.text(200, { personal: true, prompt: "Anything guests should know?", placeholder: "Please arrive by 6 pm" }),
  },
};

export const buttons: BlockDef = {
  type: "buttons", version: 1, category: "utility", label: "Buttons and links",
  fields: {
    layout: f.enum(["stack", "row"], "stack"),
    items: f.list(4, {
      label: f.text(40, { personal: true, prompt: "Button label" }),
      url: f.url(300, { personal: true, prompt: "Link, phone number or email" }),
    }, { personal: true, guided: true, prompt: "Add a button, such as a WhatsApp link or a phone number", placeholder: [] }),
  },
};

export const divider: BlockDef = {
  type: "divider", version: 1, category: "utility", label: "Divider",
  fields: { style: f.enum(["rangoli", "floral", "stars", "line"], "rangoli") },
};

export const wishes: BlockDef = {
  type: "wishes", version: 1, category: "social", label: "Wishes wall",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name the wall", placeholder: "Wishes from everyone who loves you" }),
    prompt: f.text(120, { personal: true, prompt: "What should people be asked?", placeholder: "Leave a wish for them" }),
    moderation: f.enum(["review", "auto"], "review"),
  },
};

export const replyBox: BlockDef = {
  type: "replyBox", version: 1, category: "social", label: "Reply box",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "What should the box say?", placeholder: "Write back to me" }),
    prompt: f.text(120, { personal: true, prompt: "A hint inside the box", placeholder: "Tell me what you felt" }),
    thanks: f.text(160, { personal: true, prompt: "What should it say after they send?", placeholder: "Thank you. I will read every word." }),
  },
};

export const rsvp: BlockDef = {
  type: "rsvp", version: 1, category: "social", label: "RSVP",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "What are you asking?", placeholder: "Will you join us?" }),
    deadline: f.text(60, { personal: true, prompt: "Reply by when? (optional)", placeholder: "Please reply by 1 February" }),
    guests: f.enum(["yes", "no"], "yes"),
    thanksYes: f.text(160, { personal: true, prompt: "What should it say if they are coming?", placeholder: "We cannot wait to see you." }),
    thanksNo: f.text(160, { personal: true, prompt: "What should it say if they cannot come?", placeholder: "You will be missed. Thank you for letting us know." }),
  },
};

export const voiceNote: BlockDef = {
  type: "voiceNote", version: 1, category: "memories", label: "Voice note",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Give it a title", placeholder: "A message in my voice" }),
    audio: f.audio({ personal: true, guided: true, required: true, prompt: "Record a voice note (up to a minute)" }),
    caption: f.text(160, { personal: true, prompt: "Add a line about it", placeholder: "Press play, and listen with headphones" }),
  },
};

export const map: BlockDef = {
  type: "map", version: 1, category: "utility", label: "Place on a map",
  fields: {
    title: f.text(80, { personal: true, guided: true, prompt: "Name the place", placeholder: "Where we first met" }),
    location: f.geo({ personal: true, guided: true, required: true, prompt: "Paste a map link, or latitude and longitude" }),
    note: f.text(160, { personal: true, prompt: "Add a line about it", placeholder: "The corner table, by the window" }),
  },
};
