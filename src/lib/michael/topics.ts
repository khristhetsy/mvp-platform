/**
 * What a visitor's message is about, for the Michael chat. Order matters: the
 * first match wins, the same order the approved mockup used. Pure, so every
 * case from a real conversation is a test (topics.test.ts).
 */
export type Topic =
  | "ai"
  | "license"
  | "legit"
  | "fit"
  | "background"
  | "services"
  | "name"
  | "greeting"
  | "thanks"
  | "what"
  | "how"
  | "location"
  | "experience"
  | "icapos"
  | "guarantee"
  | "spv"
  | "upfront"
  | "commission"
  | "notnow"
  | "board"
  | "info"
  | "number"
  | "budget"
  | "notinterested"
  | "fee";

const low = (s: string) => s.toLowerCase().replace(/[’`]/g, "'");

const RULES: Array<[Topic, RegExp, ((l: string) => boolean)?]> = [
  // Asking whether this is a bot. "my AI startup" is not that question.
  ["ai", /\b(are|r) (you|u) (a |an |really |actually )?(bot|robot|ai|human|real|automated|machine|person)|\bis this (a |an )?(bot|robot|ai|human|real|automated|machine|person)|(talking|speaking|chatting) (to|with) (a |an )?(bot|robot|ai|human|real|machine|person)|real person|\bchat ?bot\b|\bbot\b|\brobot\b/],
  ["license", /\bbrokers?\b|broker.?dealer|licens|registered|investment advis[eo]r|funding portal|\bfinra\b|regulated/],
  ["legit", /scam|legit|fake|rip ?off|dropped the ball|waste of time|didn'?t deliver|never delivered/],
  ["fit", /not a fit|doesn'?t fit|not (the )?right fit|not for us|(don'?t|do not|doesn'?t|not).{0,25}\bfit\b/],
  ["background", /who is michael|about (you|michael|yourself)|your (background|experience|history)|michael'?s (background|experience)|tell me about (you|yourself)|where (do|did) you (work|come from)/],
  ["services", /services|what can you do for|what do you offer|how can you help/],
  ["name", /(your|ur) name|who am i (talking|chatting|speaking)|who (is|are) (this|you)/],
  ["greeting", /^(hi|hello|hey|good (morning|afternoon|evening)|bonjour)\b/],
  ["thanks", /^(thanks|thank you|thx|cheers|great|perfect|awesome|ok|okay)\b/],
  [
    "what",
    /what do you do|what does icfo|what do you guys do|what (is|does) (your|the) company|\b(do|does)\b.*\b(company|firm|icfo|you guys)\b.*\bdo(es)?\b/,
  ],
  ["how", /how.*(work|do you)|process|steps/, (l) => !/pa[iu]d|earn|make money|charge|cost|\bpay\b/.test(l)],
  ["location", /where (are you|is icfo|are you guys) (based|located)|what city|office/],
  ["experience", /how long|since when|track record|experience|years/],
  ["icapos", /icapos|platform|software|\bapp\b/],
  ["guarantee", /guarantee|promise|will (we|i) get funded/],
  ["spv", /\bspv\b/],
  ["upfront", /(don'?t|do not|won'?t|will not|never|not going to|refuse to) (want to )?pay|no (upfront|up front) fees?|not paying/],
  ["commission", /commission|success fee|finder'?s? fee|cut of/],
  ["notnow", /not (ready|yet)|no meeting|not now|maybe later|just (looking|browsing)/],
  ["board", /\b(board|my team|partners?|co-?founders?|think about it|talk it over|discuss)\b/],
  ["info", /send (me |us )?(some |more |your |the )?(info|information|details|deck|material)|email me|more info/],
  ["number", /give me a number|a number|ball ?park|straight answer|just tell me/],
  ["budget", /no budget|can'?t afford|too expensive|don'?t have (the )?(money|budget)/],
  ["notinterested", /not interested|no thanks|not for (me|us)|\bpass\b/],
  ["fee", /cost|price|pricing|\bfees?\b|how much|charge|upfront|up front|retainer|pa[iu]d|get paid|make money|\bearn|compensat/],
];

export function topicOf(text: string): Topic | null {
  const l = low(text);
  for (const [topic, re, extra] of RULES) {
    if (re.test(l) && (!extra || extra(l))) return topic;
  }
  return null;
}

/** A reply to "what's your name?" is a name, not a question or a sentence. */
export function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (!t || /\?/.test(t)) return false;
  if (/^(can|could|what|how|who|why|do|does|is|are|send|please|tell|i)\b/i.test(t) && !/^i'?m\s+\w+$/i.test(t) && !/^i am\s+\w+$/i.test(t)) return false;
  return t.split(/\s+/).length <= 4;
}

/** "I'm Anna", "my name is Anna Lee" -> "Anna". */
export function firstName(text: string): string {
  const cleaned = text.trim().replace(/^(i'?m|i am|my name is|it'?s|this is|call me)\s+/i, "");
  const first = cleaned.split(/\s+/)[0] ?? "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}
