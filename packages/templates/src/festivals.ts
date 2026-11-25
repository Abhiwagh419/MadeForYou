import type { Template } from "@madeforyou/schema";
import { block, tpl, type BlockSpec, type TemplateSpec } from "./build";
import { cover, list, rangoli, sign } from "./parts";

interface Fest {
  id: string;
  abbr: string;
  title: string;
  titleHi?: string;
  occasions: string[];
  relationships?: string[];
  moods?: TemplateSpec["moods"];
  tags: string[];
  theme?: string;
  opening: string;
  openingKind?: TemplateSpec["openingKind"];
  ambience?: TemplateSpec["ambience"];
  tap?: TemplateSpec["tap"];
  hero: [string, string, string];
  hi?: { title: string; recipient: string; subtitle: string };
  middle?: BlockSpec[];
  wish: [string, string];
  closing?: string;
  gallery?: "grid" | "carousel" | "polaroid" | "masonry";
}

const festival = (f: Fest) =>
  tpl({
    id: f.id, abbr: f.abbr, title: f.title, titleHi: f.titleHi,
    occasions: f.occasions, relationships: f.relationships ?? ["family", "friend"], moods: f.moods ?? ["festive"],
    tags: f.tags, theme: f.theme ?? "marigold-sun",
    opening: f.opening, openingKind: f.openingKind, ambience: f.ambience ?? "confetti", tap: f.tap ?? "sparkles",
    blocks: [
      cover(f.hero[0], f.hero[1], f.hero[2], f.hi),
      rangoli(),
      ...(f.middle ?? []),
      block("text", { style: { align: "left", bg: "soft", anim: "fade-up" }, fields: { heading: f.wish[0], body: f.wish[1] } }),
      block("gallery", { fields: { layout: f.gallery ?? "grid" } }),
      sign(f.closing ?? "With love,"),
    ],
  });

export const festivals: Template[] = [
  festival({
    id: "holi-colours", abbr: "holi", title: "Holi ke rang", titleHi: "होली के रंग",
    occasions: ["holi"], moods: ["festive", "funny"], tags: ["holi", "rang", "colours", "gulal", "festival of colours", "friends"],
    opening: "Pehle gulal lagao", hero: ["Happy Holi", "Dear friends", "May your day be as colourful as you are"],
    hi: { title: "होली की हार्दिक शुभकामनाएँ", recipient: "प्यारे दोस्तों", subtitle: "आपकी ज़िंदगी में हर रंग खिले" },
    middle: [
      block("checklist", { style: { anim: "fade-up" }, fields: { title: "Holi rules we all agree on", style: "bucket", items: list("Pehle gulal, phir gale lagna", "Phones stay far from the water balloons", "Gujiya first, diet after", "Nobody escapes the colour") } }),
    ],
    wish: ["What you add to my year", "Tell them which colour they are: the loud pink one, the calm blue one, the one who always starts the water fight.\n\nThen wish them a year as bright as that."],
    closing: "Bura na maano,", gallery: "masonry",
  }),
  festival({
    id: "eid-mubarak", abbr: "eid", title: "Eid Mubarak", titleHi: "ईद मुबारक",
    occasions: ["eid"], moods: ["festive", "emotional"], tags: ["eid", "eid mubarak", "ramzan", "ramadan", "sheer khurma", "eidi", "family"],
    theme: "midnight-stars", opening: "Eid Mubarak", ambience: "stars",
    hero: ["Eid Mubarak", "Dear family", "Wishing you a day full of light and sweetness"],
    hi: { title: "ईद मुबारक", recipient: "प्यारे परिवार", subtitle: "आपका दिन रोशनी और मिठास से भरा रहे" },
    middle: [
      block("quote", { style: { anim: "fade-up" }, fields: { text: "May this Eid bring peace to your home\nand happiness to everyone you love.", author: "Eid Mubarak" } }),
      block("checklist", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Our Eid plans", style: "bucket", items: list("Sheer khurma at home", "Eidi, no excuses", "An evening visit to everyone", "One big family photo") } }),
    ],
    wish: ["My Eid wish for you", "Say it the way you would say it at the door: warm, short and from the heart.\n\nMention one memory of Eid with them that you still smile about."],
    closing: "Eid Mubarak,", gallery: "carousel",
  }),
  festival({
    id: "christmas-cheer", abbr: "xmas", title: "Merry Christmas, with love",
    occasions: ["christmas"], moods: ["festive", "emotional"], tags: ["christmas", "xmas", "merry christmas", "santa", "cake", "december"],
    theme: "rose-garden", opening: "A gift for you", openingKind: "giftbox", ambience: "confetti",
    hero: ["Merry Christmas", "Dear you", "Wishing you warmth, cake and good company"],
    middle: [
      block("reveal", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Your Christmas surprise", message: "Dinner is on me. Pick the place.", hint: "Scratch to reveal", style: "scratch" } }),
    ],
    wish: ["What I am grateful for this year", "Write the one thing about this year you would not trade, and who made it better.\n\nKeep it short and true."],
    closing: "Merry Christmas,", gallery: "polaroid",
  }),
  festival({
    id: "new-year-countdown", abbr: "nye", title: "New Year countdown", titleHi: "नया साल, नई शुरुआत",
    occasions: ["new-year"], moods: ["festive", "romantic"], tags: ["new year", "nye", "countdown", "midnight", "resolutions", "naya saal"],
    theme: "midnight-stars", opening: "Counting down", openingKind: "curtain", ambience: "confetti",
    hero: ["Happy New Year", "Dear friends", "Here is to a year better than the last"],
    hi: { title: "नया साल मुबारक", recipient: "प्यारे दोस्तों", subtitle: "आने वाला साल पिछले से बेहतर हो" },
    middle: [
      block("countdown", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Until midnight", endMessage: "Happy New Year!" } }),
      block("timeline", { style: { anim: "fade-up" }, fields: { title: "The year that was" } }),
      block("checklist", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "My wishes for next year", style: "bucket" } }),
    ],
    wish: ["Thank you for this year", "Tell them what you would have done without them this year.\n\nThen tell them what you hope for them next."],
    closing: "Happy New Year,", gallery: "polaroid",
  }),
  festival({
    id: "navratri-nine-nights", abbr: "navr", title: "Nine nights of Navratri", titleHi: "नवरात्रि की नौ रातें",
    occasions: ["navratri"], moods: ["festive"], tags: ["navratri", "garba", "dandiya", "chaniya", "nine nights", "devi"],
    opening: "Jai Mata Di", ambience: "diyas",
    hero: ["Happy Navratri", "Dear family", "Nine nights of colour, music and devotion"],
    hi: { title: "नवरात्रि की शुभकामनाएँ", recipient: "प्रिय परिवार", subtitle: "नौ रातें रंग, संगीत और भक्ति की" },
    middle: [
      block("checklist", { style: { anim: "fade-up" }, fields: { title: "Our Navratri plan", style: "bucket", items: list("Garba every night, no skipping", "A new outfit for the big night", "Prasad for everyone", "Dandiya with the whole gang") } }),
      block("event", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Garba night" } }),
    ],
    wish: ["My wish for you", "Wish them strength, good health and a home full of music.\n\nName the person you most want to see dancing this year."],
    closing: "Jai Mata Di,", gallery: "carousel",
  }),
  festival({
    id: "dussehra-victory", abbr: "dussh", title: "Dussehra, the good wins", titleHi: "दशहरा की शुभकामनाएँ",
    occasions: ["dussehra"], moods: ["festive", "funny"], tags: ["dussehra", "vijayadashami", "dasara", "ravan", "victory", "good over evil"],
    opening: "Burn the Ravan", ambience: "diyas", tap: "sparkles",
    hero: ["Happy Dussehra", "Dear friends", "May the good in you always win"],
    hi: { title: "दशहरा की हार्दिक शुभकामनाएँ", recipient: "प्यारे दोस्तों", subtitle: "आपकी अच्छाई हमेशा जीते" },
    middle: [
      block("reasons", { style: { anim: "fade-up" }, fields: { title: "Ravans I am burning this year", style: "cards", items: list("Procrastination", "The snooze button", "Overthinking every message", "Saying yes when I mean no") } }),
    ],
    wish: ["Your win this year", "Tell them what they beat this year, big or small.\n\nA good result, a hard conversation, a habit they finally quit."],
    closing: "Vijayadashami ki shubhkamnayein,", gallery: "grid",
  }),
  festival({
    id: "durga-puja-pandal", abbr: "durga", title: "Pandal hopping, Durga Puja style",
    occasions: ["durga-puja"], moods: ["festive", "emotional"], tags: ["durga puja", "pujo", "pandal", "bhog", "dhunuchi", "bengali", "shubho"],
    theme: "rose-garden", opening: "Shubho Pujo", ambience: "petals",
    hero: ["Shubho Durga Puja", "Dear friends", "Pandals, bhog and everything in between"],
    middle: [
      block("timeline", { style: { anim: "fade-up" }, fields: { title: "Our pandal hopping plan", items: [
        { date: "Saptami", title: "The first round", text: "Start early, before the crowds find us." },
        { date: "Ashtami", title: "Anjali and bhog", text: "Dress up, fold hands, eat the khichuri." },
        { date: "Navami", title: "The long walk", text: "The pandal everyone talks about." },
        { date: "Dashami", title: "Bijoya", text: "Sindoor khela and a tearful goodbye to Maa." },
      ] } }),
      block("map", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Our favourite pandal" } }),
    ],
    wish: ["What this Pujo means to me", "Write about the smell of dhunuchi, the new clothes, the people you only meet in these four days.\n\nSay you are counting the days till next year."],
    closing: "Shubho Bijoya,", gallery: "polaroid",
  }),
  festival({
    id: "karwa-chauth-promise", abbr: "karwa", title: "Karwa Chauth, from my heart", titleHi: "करवा चौथ, दिल से",
    occasions: ["karwa-chauth"], relationships: ["spouse", "partner"], moods: ["romantic", "emotional"], tags: ["karwa chauth", "karva chauth", "moon", "chaand", "wife", "husband", "fast"],
    theme: "rose-garden", opening: "A message before the moon", ambience: "petals", tap: "hearts",
    hero: ["Happy Karwa Chauth", "My love", "Because every year, I choose you again"],
    hi: { title: "करवा चौथ की शुभकामनाएँ", recipient: "मेरी जान", subtitle: "क्योंकि हर साल मैं तुम्हें ही चुनता हूँ" },
    middle: [
      block("countdown", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Until the moon", endMessage: "The moon is out. Go and see." } }),
      block("letter", { style: { align: "left", anim: "fade-up" }, fields: { salutation: "To the one who fasts for me,", closing: "Yours, always,", paper: "cream", body: "I see the early morning, the long day and the way you still smile.\n\nTell her what you notice and what it means to you." } }),
      block("checklist", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "What I promise back", style: "promises" } }),
    ],
    wish: ["Before the moon comes out", "Say the thing you do not say on normal days."],
    closing: "Yours,", gallery: "polaroid",
  }),
  festival({
    id: "bhai-dooj-tika", abbr: "bdooj", title: "Bhai Dooj, tika and sweets", titleHi: "भाई दूज का टीका",
    occasions: ["bhai-dooj"], relationships: ["brother", "sister"], moods: ["festive", "funny", "emotional"], tags: ["bhai dooj", "bhaiya dooj", "tika", "bhai", "behen", "brother", "sister", "sibling"],
    opening: "Tika time", hero: ["Happy Bhai Dooj", "Bhaiya", "Tika, sweets and a lifetime of fights"],
    hi: { title: "भाई दूज की शुभकामनाएँ", recipient: "भैया", subtitle: "टीका, मिठाई और उम्र भर की लड़ाइयाँ" },
    middle: [
      block("reasons", { style: { anim: "fade-up" }, fields: { title: "Why you are the best (and the worst) bhai", style: "flip", items: list("You still steal my food", "You took the blame when it was my fault", "You pretend not to care, and always show up") } }),
    ],
    wish: ["Dear Bhai", "Say the thing you never say on a normal day.\n\nThen ask for your gift."],
    closing: "Your behen,", gallery: "polaroid",
  }),
  festival({
    id: "ganpati-bappa-aarti", abbr: "ganpa", title: "Ganpati Bappa Morya", titleHi: "गणपति बप्पा मोरया",
    occasions: ["ganesh-chaturthi"], moods: ["festive"], tags: ["ganesh chaturthi", "ganpati", "bappa", "ganeshotsav", "aarti", "modak", "visarjan"],
    opening: "Ganpati Bappa Morya!", ambience: "diyas",
    hero: ["Ganpati Bappa Morya", "Dear family", "May Bappa remove every obstacle from your path"],
    hi: { title: "गणपति बप्पा मोरया", recipient: "प्रिय परिवार", subtitle: "बप्पा आपकी हर बाधा दूर करें" },
    middle: [
      block("event", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Evening aarti", note: "Prasad will be served after the aarti" } }),
      block("map", { style: { anim: "fade-up" }, fields: { title: "Come and see Bappa", note: "Please remove shoes at the gate" } }),
    ],
    wish: ["Come and celebrate with us", "Invite them for aarti and modak.\n\nTell them what you have asked Bappa for this year, if you want to."],
    closing: "Ganpati Bappa Morya,", gallery: "carousel",
  }),
  festival({
    id: "janmashtami-makhan", abbr: "janma", title: "Janmashtami, makhan and matki", titleHi: "जन्माष्टमी की झाँकी",
    occasions: ["janmashtami"], moods: ["festive"], tags: ["janmashtami", "krishna", "kanha", "makhan", "dahi handi", "matki", "midnight"],
    opening: "Nand ke ghar anand bhayo", ambience: "diyas",
    hero: ["Happy Janmashtami", "Dear family", "Makhan, matki and a night full of joy"],
    hi: { title: "जन्माष्टमी की शुभकामनाएँ", recipient: "प्रिय परिवार", subtitle: "माखन, मटकी और खुशियों की रात" },
    middle: [
      block("countdown", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Until Kanha's birth at midnight", endMessage: "Hathi ghoda palki, Jai Kanhaiya Lal ki!" } }),
    ],
    wish: ["Our Janmashtami", "Describe the jhaanki, the fast, the late-night aarti and the kids dressed as little Krishnas.\n\nWish them a home full of love."],
    closing: "Jai Shri Krishna,", gallery: "grid",
  }),
  festival({
    id: "sankranti-kites", abbr: "sankr", title: "Sankranti, kites and til-gul", titleHi: "मकर संक्रांति और पतंग",
    occasions: ["makar-sankranti"], moods: ["festive", "funny"], tags: ["makar sankranti", "sankranti", "uttarayan", "kite", "patang", "tilgul", "til gul", "khichdi"],
    opening: "Til gul ghya", ambience: "confetti",
    hero: ["Happy Makar Sankranti", "Dear friends", "Til gul ghya, god god bola"],
    hi: { title: "मकर संक्रांति की शुभकामनाएँ", recipient: "प्यारे दोस्तों", subtitle: "तिल गुड़ खाओ, मीठा मीठा बोलो" },
    middle: [
      block("checklist", { style: { anim: "fade-up" }, fields: { title: "Our Sankranti plan", style: "bucket", items: list("Kites on the terrace by 8 am", "Til-gul laddoos for everyone", "Undhiyu or khichdi for lunch", "Cut every kite we can see") } }),
    ],
    wish: ["Sweet words only today", "Say something sweet to someone you were sharp with this year.\n\nThat is what til-gul is for."],
    closing: "Kai po che!", gallery: "masonry",
  }),
  festival({
    id: "lohri-bonfire-invite", abbr: "lohri", title: "Lohri bonfire invite", titleHi: "लोहड़ी की रात",
    occasions: ["lohri"], moods: ["festive"], tags: ["lohri", "bonfire", "rewri", "gajak", "bhangra", "invite", "punjabi"],
    opening: "Bonfire tonight", ambience: "diyas",
    hero: ["Happy Lohri", "Dear friends", "Bonfire, rewri and a lot of bhangra"],
    hi: { title: "लोहड़ी की लख-लख बधाइयाँ", recipient: "प्यारे दोस्तों", subtitle: "आग, रेवड़ी और खूब सारा भांगड़ा" },
    middle: [
      block("event", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Lohri bonfire", note: "Bring a warm shawl and your dancing shoes" } }),
      block("rsvp", { style: { anim: "fade-up" }, fields: { title: "Will you come?", deadline: "Please reply by the day before" } }),
    ],
    wish: ["Why you must be there", "Promise them the bonfire, the peanuts, the dhol and the best company.\n\nTell them to come hungry."],
    closing: "See you at the fire,", gallery: "grid",
  }),
  festival({
    id: "pongal-overflow", abbr: "pongal", title: "Pongal o Pongal",
    occasions: ["pongal"], moods: ["festive", "emotional"], tags: ["pongal", "thai pongal", "harvest", "kolam", "sugarcane", "bhogi", "tamil"],
    opening: "Pongal o Pongal!", ambience: "petals",
    hero: ["Happy Pongal", "Dear family", "May your pot overflow with joy"],
    middle: [
      block("reasons", { style: { anim: "fade-up" }, fields: { title: "What I am thankful for this harvest", style: "cards", items: list("A home that is always warm", "Food that is always shared", "People who show up every time") } }),
    ],
    wish: ["A harvest of good things", "Write about the kolam at the door, the sweet pongal, and the people around the pot.\n\nWish them a year that overflows."],
    closing: "Inia Pongal nalvazhthukkal,", gallery: "grid",
  }),
  festival({
    id: "onam-sadya", abbr: "onam", title: "Onam, pookalam and sadya",
    occasions: ["onam"], moods: ["festive"], tags: ["onam", "thiruvonam", "pookalam", "sadya", "kerala", "mahabali", "malayali"],
    opening: "Onashamsakal", ambience: "petals",
    hero: ["Happy Onam", "Dear friends", "Pookalam, sadya and a king's return"],
    middle: [
      block("checklist", { style: { anim: "fade-up" }, fields: { title: "The sadya we must eat", style: "bucket", items: list("Payasam, two helpings", "Banana chips before the meal", "Everything served on a banana leaf") } }),
      block("featured", { style: { bg: "soft", anim: "fade-up" }, fields: { frame: "ornate", caption: "Our pookalam this year" } }),
    ],
    wish: ["My Onam wish for you", "Tell them what you will eat, who you will see, and who you will miss at the table.\n\nWish them the same abundance Mahabali's kingdom had."],
    closing: "Happy Onam,", gallery: "polaroid",
  }),
  festival({
    id: "baisakhi-bhangra", abbr: "baisa", title: "Baisakhi, bhangra and harvest", titleHi: "बैसाखी की बधाई",
    occasions: ["baisakhi"], moods: ["festive", "funny"], tags: ["baisakhi", "vaisakhi", "bhangra", "harvest", "punjabi", "khalsa"],
    opening: "Dhol baje!", ambience: "confetti",
    hero: ["Happy Baisakhi", "Dear family", "Harvest, hope and a whole lot of bhangra"],
    hi: { title: "बैसाखी की लख-लख बधाइयाँ", recipient: "प्रिय परिवार", subtitle: "फसल, उम्मीद और ढेर सारा भांगड़ा" },
    middle: [
      block("video", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Our bhangra, on video", caption: "Watch till the end" } }),
    ],
    wish: ["For a good harvest", "Wish them a year of good crops, good health and good food.\n\nMention the person who dances the worst and the loudest."],
    closing: "Baisakhi diyan vadhaiyan,", gallery: "masonry",
  }),
  festival({
    id: "gudi-padwa-ugadi-new-year", abbr: "gudi", title: "Gudi Padwa and Ugadi wishes", titleHi: "गुढी पाडवा और उगादी",
    occasions: ["gudi-padwa-ugadi"], moods: ["festive", "emotional"], tags: ["gudi padwa", "ugadi", "yugadi", "new year", "marathi", "telugu", "kannada", "neem", "bevu bella"],
    opening: "Raise the gudi", ambience: "petals",
    hero: ["Happy Gudi Padwa and Ugadi", "Dear family", "A new year, new beginnings"],
    hi: { title: "गुढी पाडवा और उगादी की शुभकामनाएँ", recipient: "प्रिय परिवार", subtitle: "नया साल, नई शुरुआत" },
    middle: [
      block("quote", { style: { anim: "fade-up" }, fields: { text: "Neem and jaggery together:\nlife brings both, and we take it all with a smile.", author: "The spirit of the new year" } }),
      block("checklist", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "My hopes for this new year", style: "bucket" } }),
    ],
    wish: ["What I wish for you", "Wish them the sweet and the bitter in the right amounts.\n\nName one thing you hope will start for them this year."],
    closing: "Nutan varshachya shubhechha,", gallery: "grid",
  }),
  festival({
    id: "independence-day-india", abbr: "indep", title: "Independence Day, with pride", titleHi: "स्वतंत्रता दिवस की बधाई",
    occasions: ["independence-day"], relationships: ["friend", "family", "colleague"], moods: ["festive", "emotional"], tags: ["independence day", "15 august", "tiranga", "azadi", "india", "freedom", "jai hind"],
    opening: "Jai Hind", ambience: "confetti",
    hero: ["Happy Independence Day", "Dear friends", "Grateful for the freedom to dream"],
    hi: { title: "स्वतंत्रता दिवस की शुभकामनाएँ", recipient: "प्यारे दोस्तों", subtitle: "सपने देखने की आज़ादी के लिए शुक्रगुज़ार" },
    middle: [
      block("reasons", { style: { anim: "fade-up" }, fields: { title: "Things I love about India", style: "cards", items: list("Chai at every corner", "A festival every other week", "Strangers who become friends in one train ride") } }),
    ],
    wish: ["What freedom means to me", "Write in your own words what this day makes you think of.\n\nA grandparent's story, a flag on the school ground, a small freedom you value."],
    closing: "Jai Hind,", gallery: "grid",
  }),
  festival({
    id: "republic-day-we-the-people", abbr: "repub", title: "Republic Day, we the people", titleHi: "गणतंत्र दिवस की शुभकामनाएँ",
    occasions: ["republic-day"], relationships: ["friend", "family", "colleague"], moods: ["festive", "minimal"], tags: ["republic day", "26 january", "gantantra diwas", "constitution", "tiranga", "india", "jai hind"],
    opening: "Jai Hind", ambience: "none",
    hero: ["Happy Republic Day", "Dear friends", "Proud of what we are building together"],
    hi: { title: "गणतंत्र दिवस की हार्दिक शुभकामनाएँ", recipient: "प्यारे दोस्तों", subtitle: "जो हम मिलकर बना रहे हैं, उस पर गर्व है" },
    middle: [
      block("checklist", { style: { anim: "fade-up" }, fields: { title: "What I promise my country", style: "promises", items: list("To vote every time", "To keep my street clean", "To stand up when something is unfair") } }),
    ],
    wish: ["Why I am proud", "Say what you are proud of in a few honest lines.\n\nKeep it personal: a teacher, a town, a small thing that works well."],
    closing: "Jai Hind,", gallery: "grid",
  }),
  festival({
    id: "maha-shivratri-night", abbr: "shiv", title: "Maha Shivratri, a night of stillness", titleHi: "महाशिवरात्रि की रात",
    occasions: ["mahashivratri"], moods: ["festive", "minimal"], tags: ["maha shivratri", "shivratri", "shiv", "bholenath", "mahadev", "om namah shivaya"],
    theme: "midnight-stars", opening: "Om Namah Shivaya", ambience: "stars", tap: "sparkles",
    hero: ["Maha Shivratri", "Dear family", "A night of stillness, devotion and wakefulness"],
    hi: { title: "महाशिवरात्रि की शुभकामनाएँ", recipient: "प्रिय परिवार", subtitle: "शांति, भक्ति और जागरण की रात" },
    middle: [
      block("quote", { style: { anim: "fade-up" }, fields: { text: "Har Har Mahadev", author: "A night for peace" } }),
    ],
    wish: ["My wish for you", "Wish them peace, calm minds and a year with less noise.\n\nThis page can be short and quiet."],
    closing: "Om Namah Shivaya,", gallery: "carousel",
  }),
  festival({
    id: "gurpurab-vadhai", abbr: "gurpu", title: "Gurpurab di vadhai", titleHi: "गुरपुरब की बधाई",
    occasions: ["gurpurab"], moods: ["festive", "emotional"], tags: ["gurpurab", "guru nanak", "nanak jayanti", "prakash purab", "waheguru", "langar"],
    opening: "Waheguru ji", ambience: "diyas",
    hero: ["Gurpurab di vadhai", "Dear family", "May the light of the Guru always guide us"],
    hi: { title: "गुरपुरब की लख-लख बधाइयाँ", recipient: "प्रिय परिवार", subtitle: "गुरु की रोशनी हमेशा राह दिखाए" },
    middle: [
      block("quote", { style: { anim: "fade-up" }, fields: { text: "Naam japo, kirat karo, vand chhako.", author: "Remember, work honestly, share with others" } }),
    ],
    wish: ["Our Gurpurab", "Write about the prabhat pheri, the langar, and the sewa you shared.\n\nWish them peace and chardi kala."],
    closing: "Waheguru ji ka Khalsa,", gallery: "carousel",
  }),
  festival({
    id: "rakhi-from-far", abbr: "rakfar", title: "Rakhi from far away", titleHi: "दूर से राखी",
    occasions: ["raksha-bandhan"], relationships: ["brother", "sister"], moods: ["festive", "emotional"], tags: ["rakhi", "raksha bandhan", "long distance", "bhai", "bhaiya", "behen", "sister", "brother", "courier"],
    opening: "Your rakhi has arrived", ambience: "confetti",
    hero: ["Happy Raksha Bandhan", "Bhaiya", "The rakhi may be late. The love never is"],
    hi: { title: "रक्षा बंधन की शुभकामनाएँ", recipient: "भैया", subtitle: "राखी देर से पहुँचे, प्यार नहीं" },
    middle: [
      block("countdown", { style: { bg: "soft", anim: "zoom" }, fields: { title: "Until I can tie it myself", endMessage: "Come here and hold out your hand" } }),
      block("voiceNote", { style: { anim: "fade-up" }, fields: { title: "Listen to this, bhai", caption: "Press play" } }),
    ],
    wish: ["Thank you, bhai", "Tell him about the one time he was there when it counted.\n\nTell him you are saving the best sweet for him."],
    closing: "Your sister,", gallery: "polaroid",
  }),
  festival({
    id: "diwali-party-invite", abbr: "dwpart", title: "Diwali party invite", titleHi: "दिवाली पार्टी का निमंत्रण",
    occasions: ["diwali", "get-together"], moods: ["festive"], tags: ["diwali", "party", "invite", "invitation", "diya", "rangoli", "get together", "cards night"],
    opening: "Light a diya", ambience: "diyas",
    hero: ["You are invited", "Dear friends", "Come and light up Diwali with us"],
    hi: { title: "आप आमंत्रित हैं", recipient: "प्यारे दोस्तों", subtitle: "दिवाली हमारे साथ मनाइए" },
    middle: [
      block("event", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Diwali get-together", note: "Come in your festive best" } }),
      block("map", { style: { anim: "fade-up" }, fields: { title: "How to find us" } }),
      block("rsvp", { style: { bg: "soft", anim: "fade-up" }, fields: { title: "Will you join us?", deadline: "Please reply by Dhanteras" } }),
    ],
    wish: ["What to expect", "Mention the food, the lights, the cards and anything people should bring.\n\nKeep it warm and relaxed."],
    closing: "See you soon,", gallery: "grid",
  }),
  festival({
    id: "diwali-business-greeting", abbr: "dwbiz", title: "Diwali greeting for clients",
    occasions: ["diwali"], relationships: ["colleague", "client"], moods: ["festive", "minimal"], tags: ["diwali", "business", "clients", "customers", "shop", "office", "team", "professional"],
    theme: "rose-garden", opening: "A Diwali message", ambience: "diyas", tap: "none",
    hero: ["Happy Diwali", "Our valued customers", "Thank you for another bright year together"],
    middle: [
      block("reasons", { style: { anim: "fade-up" }, fields: { title: "Thank you for", style: "cards", items: list("Trusting us again this year", "Telling your friends about us", "Being patient when we were slow") } }),
      block("buttons", { style: { bg: "soft", anim: "fade-up" }, fields: { layout: "stack" } }),
    ],
    wish: ["Our wish for you", "Thank them in two or three honest lines.\n\nMention any festive offer or opening hours at the end."],
    closing: "With gratitude,",
  }),
];
