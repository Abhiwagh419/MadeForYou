/**
 * The controlled vocabulary behind search. Synonyms cover English, Roman-script Hindi
 * and Devanagari, so "maa", "mom", "amma" and "माँ" all reach Mother's Day.
 * This moves to the `occasions` table in Supabase later; the shape stays the same.
 */
export interface Occasion {
  id: string;
  name: string;
  hi?: string;
  group: "family" | "love" | "friends" | "festival" | "milestone" | "words";
  synonyms: string[];
}

export const OCCASIONS: Occasion[] = [
  { id: "mothers-day", name: "Mother's Day", hi: "मदर्स डे", group: "family",
    synonyms: ["mother", "mom", "mum", "mummy", "maa", "ma", "mata", "amma", "aai", "ammi", "mothers day", "माँ", "मां", "आई", "अम्मा"] },
  { id: "fathers-day", name: "Father's Day", hi: "फादर्स डे", group: "family",
    synonyms: ["father", "dad", "daddy", "papa", "pappa", "baba", "appa", "abba", "pitaji", "fathers day", "पापा", "पिता", "बाबा"] },
  { id: "birthday", name: "Birthday", hi: "जन्मदिन", group: "milestone",
    synonyms: ["bday", "b'day", "janmadin", "janam din", "happy birthday", "birth day", "जन्मदिन", "जन्मदिवस"] },
  { id: "anniversary", name: "Anniversary", hi: "सालगिरह", group: "love",
    synonyms: ["anniv", "saalgirah", "wedding anniversary", "years together", "सालगिरह"] },
  { id: "girlfriends-day", name: "Girlfriend's Day", group: "love",
    synonyms: ["girlfriend", "gf", "girlfriends day", "girl friend", "her", "my girl", "lover"] },
  { id: "boyfriends-day", name: "Boyfriend's Day", group: "love",
    synonyms: ["boyfriend", "bf", "boyfriends day", "boy friend", "him", "my boy"] },
  { id: "valentines", name: "Valentine's Day", hi: "वैलेंटाइन डे", group: "love",
    synonyms: ["valentine", "valentines day", "love", "romantic", "romance", "partner", "pyaar", "pyar", "propose", "proposal", "i love you", "crush"] },
  { id: "friendship-day", name: "Friendship Day", hi: "फ्रेंडशिप डे", group: "friends",
    synonyms: ["friend", "friends", "dost", "yaar", "bestie", "bff", "best friend", "friendship", "दोस्त", "यार"] },
  { id: "teachers-day", name: "Teachers' Day", hi: "शिक्षक दिवस", group: "words",
    synonyms: ["teacher", "teachers", "guru", "sir", "madam", "mam", "shikshak", "professor", "mentor", "शिक्षक", "गुरु"] },
  { id: "raksha-bandhan", name: "Raksha Bandhan", hi: "रक्षा बंधन", group: "festival",
    synonyms: ["rakhi", "rakshabandhan", "bhai", "bhaiya", "behen", "behna", "bhai behen", "sister", "brother", "sibling", "siblings", "राखी", "भैया", "बहन"] },
  { id: "diwali", name: "Diwali", hi: "दिवाली", group: "festival",
    synonyms: ["deepavali", "dipawali", "festival of lights", "diya", "diyas", "दिवाली", "दीपावली"] },
  { id: "holi", name: "Holi", hi: "होली", group: "festival", synonyms: ["rang", "colours", "colors", "festival of colours", "होली"] },
  { id: "eid", name: "Eid", hi: "ईद", group: "festival", synonyms: ["eid mubarak", "ramzan", "ramadan", "eid ul fitr", "ईद"] },
  { id: "christmas", name: "Christmas", group: "festival", synonyms: ["xmas", "merry christmas", "santa"] },
  { id: "new-year", name: "New Year", hi: "नया साल", group: "festival", synonyms: ["happy new year", "nye", "naya saal", "new years"] },
  { id: "farewell", name: "Farewell", hi: "विदाई", group: "milestone",
    synonyms: ["goodbye", "bye", "leaving", "retirement", "retire", "last day", "vidai", "colleague", "coworker", "send off", "विदाई"] },
  { id: "graduation", name: "Graduation", group: "milestone", synonyms: ["convocation", "degree", "pass out", "passing out", "graduate"] },
  { id: "wedding", name: "Wedding", hi: "शादी", group: "milestone",
    synonyms: ["shaadi", "marriage", "invite", "invitation", "vivah", "engagement", "sagai", "शादी"] },
  { id: "thank-you", name: "Thank You", hi: "धन्यवाद", group: "words",
    synonyms: ["thanks", "gratitude", "thankful", "shukriya", "dhanyavad", "धन्यवाद", "शुक्रिया"] },
  { id: "sorry", name: "Sorry", hi: "माफ़ी", group: "words",
    synonyms: ["apology", "apologize", "apologise", "maafi", "maaf", "forgive", "forgiveness", "माफ़ी"] },
  { id: "get-well", name: "Get Well Soon", group: "words", synonyms: ["get well", "recovery", "sick", "health", "speedy recovery"] },
  { id: "congratulations", name: "Congratulations", hi: "बधाई", group: "milestone",
    synonyms: ["congrats", "well done", "achievement", "promotion", "new job", "badhai", "बधाई"] },
];

export const getOccasion = (id: string) => OCCASIONS.find((o) => o.id === id);
