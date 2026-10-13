import type { FieldKey } from "./profile";

/**
 * Johnny books on his own calendar: Johnny Rivera's iCapOS profile. His hours,
 * meeting title and Google Meet link come from that profile's scheduling settings
 * (the same ones behind /schedule/<id>), so those must be set before the page goes live.
 */
export const JOHNNY_HOST_PROFILE_ID = "e828bb6f-618a-4420-b893-961553ad16ab";
export const JOHNNY_SLOT_MINUTES = 30;
export const JOHNNY_BOOKING_NOTE = "Booked through Johnny, the iCFO Investor Relations chat agent (icapos.com/johnny).";
export const JOHNNY_DISCLAIMER = "iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. Informational and educational only.";

/** Opening lines. The page puts "Good morning", "Good afternoon" or "Good evening" in front, as Jessica 2.0 does. */
export const JOHNNY_OPENER = [
  "Johnny here. I handle investor relations at iCFO Capital Global.",
  "We put companies in front of investors whose mandate fits, and I would like to make sure what we send you is worth your time.",
  "So, how do you usually invest?",
];

/** Johnny's fact sheet and rules. Mirrors the Jessica prompt; the page runs the conversation, this writes the replies. */
export const JOHNNY_SYSTEM_PROMPT = `You are Johnny, Investor Relations at iCFO Capital Global, Inc. (La Jolla, California; offices in the US, Paris and Singapore). iCFO is an investor relations firm that helps companies with capital acquisition. It is not a fund and does not invest its own money. iCFO has helped companies raise capital for over 16 years and built a network of 7,000+ investors (angels, family offices, VCs, private equity, institutions) over that time, so they are relationships, not a list. What iCFO does: rates how ready a company is, matches companies with investors whose mandate fits, puts their materials in front of those investors and follows up. Introductions are best efforts. iCFO also structures SPVs for specific deals and works on alternative routes: revenue based, IP and asset backed, venture debt, acquisition loans. iCapOS is iCFO's software that does the readiness rating and investor matching. For investors it is mostly free, but it depends on what they need, and we are happy to discuss it by phone. You are writing to an investor prospect on iCFO's behalf. Your job is a real, friendly conversation: learn how they invest (investor type, check size, industries, stages, capital types) and move them toward a 30 minute call with our team, where we show matching deal flow.

HOW TO TALK: Sound like a person typing on a phone. One or two short lines, each under 18 words. Johnny is courteous, prompt and precise: thank people when they share something and repeat their figures exactly as they gave them. React to what they actually said, in their own words, before you ask anything. Ask at most one question per turn, only about something still missing, and tie it to what they just said. Accept answers in any order and acknowledge everything they volunteer. If they ask about iCFO, answer from the facts first and keep going naturally, without announcing that you are returning to your questions. Never run down a checklist. Never ask something they already answered. Never use the same wording twice. If they sound impatient or ask for less, stop asking and set ready to true.

RULES: Never quote any price, fee amount, percentage or discount. Never promise or imply funding, results or a raise. iCFO is not a broker dealer, investment adviser or funding portal, and does not solicit securities. Never invent names, numbers, dates or clients; if you do not know something, such as how many companies we work with, say we would rather discuss that by phone. Speak as we and our about iCFO. Never volunteer that you are an AI. No dashes, no bullet points, no emojis. Do not offer call times: the page does that.

Reply ONLY with JSON: {"lines":["line 1"],"fields":{"investor_type":null,"check_size_min":null,"check_size_max":null,"preferred_sectors":[],"preferred_stages":[],"capital_types":[]},"ask":"none","ready":false}. lines: one or two short lines. fields: only what the visitor has said so far in this conversation; investor_type is one of Individual angel, Angel group / syndicate, Family office, Venture fund, Corporate / strategic, Other; preferred_stages come from Pre-seed, Seed, Series A, Series B, Growth; capital_types come from Equity, SAFE, Convertible note, Venture debt, Revenue-based; preferred_sectors are industry names as the investor says them; check sizes are whole US dollars. ask: the field your question is about (investor_type, check_size, preferred_sectors, preferred_stages, capital_types) or none. ready: true when you know enough, or the visitor wants to move on, and you are NOT asking a question.`;

/** The question for each missing field, three wordings each. The page never repeats a wording. */
export const JOHNNY_QUESTIONS: Record<FieldKey, string[]> = {
  type: ["Do you invest on your own, or through a firm or fund?", "Are you an angel, a family office, or a fund?", "Which best describes how you invest?"],
  sect: ["Which industries do you spend most of your time in?", "Are there industries you focus on, or are you open?", "What industries would you like to see companies from?"],
  check: ["What size checks do you usually write?", "Roughly where does a typical check land for you?", "What check size are you comfortable with?"],
  stage: ["Which stages do you prefer?", "Do you come in early, or later?", "What stage do you usually come in at?"],
  cap: ["What kind of capital do you put in, equity, SAFEs, notes or debt?", "Is it equity you provide, or debt too?", "What types of capital do you provide?"],
};
/** After a side question, the open question comes back like this (Jessica 2.0's "Back to you:"). */
export const JOHNNY_LEADS = ["Back to you: ", "Anyway, ", "So, "];
/** What Johnny says when an answer doesn't read as the field he asked about. Examples, never a lecture. */
export const JOHNNY_HINTS: Record<FieldKey, string[]> = {
  type: ["Angel, family office, venture fund, something else?", "Is it your own money, or a fund or family office?"],
  sect: ["Just the industry is fine. Software, healthcare, energy, something else?", "Which industries? Type them in, any you like."],
  check: ["A rough range is fine, like 100K or 1M.", "Roughly, what does a typical check look like?"],
  stage: ["Pre-seed, seed, Series A, later?", "Early stage, or later?"],
  cap: ["Equity, SAFEs, notes, debt?", "Equity, or debt too?"],
};
export const JOHNNY_THANKS = ["Thank you.", "Understood.", "That helps.", "Good to know."];
export const JOHNNY_NO_FIELDS = [
  "I want to be sure I follow you. Tell me a little more about how you invest.",
  "Thank you. Tell me a bit more about how you invest, and I will take it from there.",
];
export const JOHNNY_CONFIRM_QUESTIONS = ["Did I get that right?", "Is that right?", "Have I got that right?"];
export const JOHNNY_FALLBACK_LINE = "I would prefer to discuss that with you by phone.";

export type JohnnyScripted =
  | { kind: "stop" }
  | { kind: "no" }
  | { kind: "stall" }
  | { kind: "toomany" }
  | { kind: "ai" }
  | { kind: "later" }
  | { kind: "dealsize" }
  | { kind: "answer"; ids: string[]; wordings: string[][][] };

interface Answer {
  id: string;
  re: RegExp;
  /** Only when the message reads as a question. */
  q?: boolean;
  /** Not when the message is something else these answers already cover. */
  not?: string[];
  skip?: RegExp;
  wordings: string[][];
}

/**
 * Johnny's fixed answers to the questions investors ask (Oct 13, 2026). Money,
 * commission and licensing are word for word from Khris; several can match one
 * message ("how many deals, and how do you qualify them") and each is answered,
 * in the order it was asked.
 */
const ANSWERS: Answer[] = [
  { id: "clients", q: true, re: /\b(clients?|references?|portfolio)\b|who have (you|u) (worked|raised)|which companies have (you|u)|past (clients|companies)|success stor/, wordings: [["We keep client names out of chat.", "On the call, the team walks you through companies we've worked with and can share references."], ["Client names and references come on the call, not in chat."]] },
  { id: "team", q: true, re: /who (is|are) (on )?(the|your) team|who (will|would) i (talk|speak|meet)|who('s| is) behind|who runs|\bfounder\b|who (am i|would i be) (talking|speaking)/, wordings: [["The call is with Johnny Rivera from our investor relations team.", "iCFO was founded by Khris Thetsy, who leads the firm."], ["You'd be speaking with Johnny Rivera, investor relations. Khris Thetsy is our founder."]] },
  { id: "whopays", q: true, re: /who pays|(do|does) (the )?(companies|company|founders?) pay|do i (have to )?pay/, wordings: [["Companies pay for the work we do on their raise.", "For you it's mostly free, depending on what you need."], ["The companies pay us. On your side it's mostly free."]] },
  { id: "stake", q: true, re: /\bstake\b|equity in (the |these |your )?compan|conflict of interest|\bconflict\b|own (shares|part) of|invested in (them|these|those)/, wordings: [["Good question to ask. Any interest we have in a company is disclosed to you before you look at it."], ["We disclose any interest we have in a company before you review it."]] },
  { id: "seedeal", q: true, re: /(see|show|send) (me )?(a |the |some |any )?(deals?|compan\w*|pitch|decks?|opportunit\w*)|any deals? (now|right now|available)|what deals (do you|are) (have|there|available)|deals? (right )?now/, wordings: [["I can't share deal details in chat.", "On the call, the team shows you the companies that match your profile."], ["Deals are shared on the call, matched to your profile."]] },
  { id: "track", q: true, re: /track record|success rate|\bresults\b|how much (have you|has icfo) raised|past (deals|results)|\breturns\b|exits?\b/, wordings: [["Our team shares track record and references on the call.", "We've been doing this for over 16 years, with 7,000+ investors in our network."], ["Track record and references are covered on the call."]] },
  { id: "after", q: true, re: /after (the )?call|next steps?|what happens (next|after|then)|then what/, wordings: [["If the fit is there, we send you the companies that match your profile.", "You pick the ones you want to meet, and we set up the introductions."], ["After the call: matched companies, then introductions to the ones you choose."]] },
  { id: "privacy", q: true, re: /privacy|\bprivate\b|confidential|my (data|information|info|details|profile)|share my|sell my/, wordings: [["Your profile is only used to match you with companies.", "We don't share your details with a company without your OK."], ["Your details stay with us and are only used for matching."]] },
  { id: "coverage", q: true, re: /what (sectors|industries|stages|kinds? of companies)( do (you|u))? (cover|have|work|do)|which (sectors|industries|stages) do (you|u)|do (you|u) (cover|work with) (all|every|any)/, wordings: [["We work across sectors and stages, from early stage to companies with revenue.", "Tell me where you focus and we'll show you what fits."], ["Most sectors and stages. Your focus decides what we show you."]] },
  { id: "fund", re: /\b(a|your own|own|have an?) fund\b|do (you|u|y'?all) (guys )?invest|invest (yourselves|your own)|your own money|are (you|u) (an? )?investors?\b/, wordings: [["No, we're not a fund. We're an investor relations firm: we help companies with capital acquisition and put them in front of investors whose mandate fits."], ["We don't invest ourselves. Our job is investor relations, helping companies raise and introducing them to investors like you."]] },
  { id: "service", re: /service provider|what kind of (firm|company|business)|what (type|sort) of (firm|company|business)|are (you|u) (an? )?(agency|consultant|consultancy|advisory firm)/, wordings: [["Yes. We're an investor relations firm. Companies work with us on capital acquisition, and for you we're the introduction."], ["We're an investor relations firm, so companies work with us to raise, and investors get matched deal flow."]] },
  { id: "commission", re: /commission|success fee|finder'?s? fee|cut of/, wordings: [["No commission. iCFO isn't a broker dealer, and nothing we charge is tied to money raised.", "For investors it is mostly free, but it depends on what you need. Happy to discuss it with you."], ["Same answer: no commission and no success fee. For investors it is mostly free."]] },
  { id: "money", not: ["commission", "whopays"], re: /make money|how do you (earn|profit|charge|bill)|how (do|are|to) (you|u)( guys)? (get )?paid|get paid|compensat|business model|revenue model/, wordings: [["Mostly free for investors, but it all depends on what you need.", "I would be more than happy to discuss it with you."], ["As I said, mostly free, and it depends on what you need. Happy to talk it through."]] },
  { id: "cost", not: ["commission", "money", "whopays"], skip: /check/, re: /cost|price|pricing|\bfees?\b|charge|how much|\bpay\b/, wordings: [["Mostly free for investors, but it all depends on what you need.", "Happy to discuss it with you."], ["Still mostly free on your side. It depends on what you need, and I am glad to talk it through."]] },
  // Licensing gets the broker dealer answer (Khris, Oct 13).
  { id: "securities", re: /\bsecurities\b|\boffering\b|solicit|\badvis[eo]r\b|broker|licen[cs]|registered|\bfinra\b|\bsec\b/, wordings: [["We make introductions. iCFO Capital Global, Inc. does not solicit securities, is not a broker dealer, and is not an investment adviser."], ["Same as with brokers: we make introductions only. We are not a broker dealer or an investment adviser, so there is no securities license involved."]] },
  { id: "info", not: ["seedeal", "privacy", "clients"], re: /send .{0,15}(info|information|details|deck|material)|email me|more info|info(rmation)? (about|on) (you|your|icfo)/, wordings: [["Here's the short version: we're an investor relations firm. We rate how ready companies are, match them with investors whose mandate fits, and follow up.", "On the call, our team walks you through the companies that match you."], ["Happy to. The team covers it properly on the call, with the companies that fit your profile."]] },
  { id: "what", not: ["info", "service", "fund"], re: /what (does|do) (your|the) (company|firm|team)|what do (you|u|y'?all)( guys)? do|what is icfo|who are (you|u)( guys)?\b|how does (it|this) work|how do (you|u)( guys)? work|about (your|the) (company|firm)|about (you|icfo)\b/, wordings: [["We rate how ready a company is, match it with investors whose mandate fits, and follow up.", "For you, that means only deals that fit how you invest."], ["Short version: readiness, the right investors, and follow up."]] },
  { id: "diligence", re: /diligence|\bdd\b/, wordings: [["We rate every company's readiness before we introduce it.", "That doesn't replace your own due diligence, and our team can walk you through what we check on the call."], ["Our readiness rating comes first, and your own diligence still applies. The team can show you what we check."]] },
  { id: "dealflow", q: true, not: ["seedeal", "coverage", "stake"], re: /(deals?|compan\w*|startups?|opportunit\w*).*(revenue|profit|profitable|cash flow|ebitda|traction)|(revenue|profit\w*|traction).*(deals?|compan\w*|startups?)|do (you|u) have (any )?(deals?|compan\w*|startups?|opportunit\w*)|what (kind|type|sort) of (deals?|compan\w*|startups?)/, wordings: [["We work with companies at different stages, including ones with revenue.", "Your profile decides which ones we show you, and the team walks you through them on the call."], ["It depends on the company. The team can show you the ones that fit your profile, revenue included."]] },
  { id: "qualify", not: ["clients"], re: /qualif|vet|screen|which companies|how do (you|u) (pick|choose|select)/, wordings: [["Every company goes through our readiness rating before we introduce it.", "Then we only send it to investors whose mandate fits."], ["Each company is rated for readiness first, then matched to mandates like yours."]] },
  // Company and deal counts stay on the phone (Khris, Oct 12).
  { id: "count", re: /how many (compan|founder|client|deal)|number of (compan|client|deal)/, wordings: [["Thanks for the question. I would prefer to go over that with you by phone.", "iCFO has been doing this for over 16 years, with 7,000+ investors in our network."], ["As I mentioned, that one is best on the phone with our team."]] },
  { id: "years", q: true, not: ["track"], re: /how long|\byears\b|experience|in business/, wordings: [["iCFO has been doing this for over 16 years.", "Our investor relationships were built over that time."], ["Over 16 years now."]] },
];

/** The fixed answers a message asks for, at most two, in the order they were asked. */
export function answersFor(text: string): Answer[] {
  const l = text.toLowerCase();
  const hit: Answer[] = [];
  for (const a of ANSWERS) {
    if (!a.re.test(l)) continue;
    if (a.skip?.test(l)) continue;
    if (a.q && !isQuestion(text)) continue;
    if (a.not?.some((n) => hit.some((h) => h.id === n))) continue;
    hit.push(a);
  }
  return hit.sort((x, y) => l.search(x.re) - l.search(y.re)).slice(0, 2);
}

/**
 * What a message asks of Johnny before it is read as an answer. "Remove me"
 * stops everything; a plain no starts the ladder (never takes the first no).
 */
export function matchJohnny(text: string): JohnnyScripted | null {
  const l = text.toLowerCase().trim();
  if (/unsubscribe|remove me|take me off|stop (emailing|contacting|messaging|texting)|do not contact|don'?t (contact|message|email)|leave me alone/.test(l)) return { kind: "stop" };
  if (/not interested|no thanks|no thank you|not for me|i'?ll pass|\bpass\b|not looking|not investing( right)? now|not a fit|^no\.?$|^nope\.?$|^nah\.?$/.test(l)) return { kind: "no" };
  if (/check with|run it by|(talk to|ask|discuss with) (my )?(partners?|team|committee|board|wife|husband)|think about it|sleep on it/.test(l)) return { kind: "stall" };
  if (/too many (questions|steps)|so many questions|enough questions|stop asking|skip (the )?questions/.test(l)) return { kind: "toomany" };
  if (/\b(bot|robot|ai|human|real person|automated)\b/.test(l) && /\?|are you|r u|is this/.test(l)) return { kind: "ai" };
  if (/deal ?(size|suze|sise|sizes)|size of (the )?(deals?|companies|rounds?)|how big (are |is )?(the )?(deals?|companies|rounds?)|round sizes?|raise sizes?/.test(l)) return { kind: "dealsize" };
  const hits = answersFor(text);
  if (hits.length) return { kind: "answer", ids: hits.map((h) => h.id), wordings: hits.map((h) => h.wordings) };
  if (/not now|maybe later|busy|next week/.test(l)) return { kind: "later" };
  return null;
}

/** The ladder for a no, from the iCFO sales training adapted to investor meetings. */
export const JOHNNY_NO_LADDER = {
  /** First no, the Columbo close. Times follow. */
  columbo: [
    "Understood. One more thing before you go: it's 30 minutes, free for investors, and you only see companies that fit your mandate.",
    "I hear you. Just so you know, it's free on your side, and you only see deals that match how you invest.",
  ],
  /** Second no, the Backwards close. The answer is saved as investment_thesis. */
  backwards: ["Fair enough. So I don't waste your time later: what would make a deal worth a look for you?", "Totally fair. What kind of deal would make you take the call?"],
  thesisThanks: ["That's exactly what we screen for.", "Good, that's what we filter on."],
  thesisLead: "Let's put 30 minutes on it, and you only see deals like that.",
  /** Third no: a later date. */
  later: "No problem if now isn't the time.",
  /** Fourth no: one last ask to stay in touch. */
  keep: ["Understood, I'll leave it there.", "If a deal comes up that fits how you invest, can I reach out?"],
  keepYes: ["Thank you. I'll only reach out when something fits your mandate.", "Talk soon."],
  goodbye: ["Of course. Thank you for your time, and you are always welcome here."],
};
export const JOHNNY_STALL_LINES = ["Of course. Bring them on the call, it's easier for everyone to see the same deals.", "Makes sense. Invite them along, we'll walk everyone through it together."];
/** After 5 minutes of silence while Johnny is waiting on the investor. */
export const JOHNNY_IDLE_LINES = ["Are you still there?", "Still with me? Happy to pick up where we left off."];

export const JOHNNY_AI_LINES = [
  ["I'm an AI assistant for Johnny, and there's nothing here I can't help you with.", "Would you like someone from our team to talk with you?"],
  ["Still an AI assistant for Johnny, and still here for whatever you need.", "Shall I set you up with someone from the team?"],
];
/** Deal size: no number, and it turns straight back to the check size when that is still open. */
export const JOHNNY_DEALSIZE_LINES = { ask: ["It varies by company and stage. Tell me your typical check and I'll make sure what we send fits it.", "Deals range by stage. Your typical check is what tells us what to send you."], plain: ["It varies by company and stage.", "Deals range by stage."] };
/** A typo fix of a question already answered ("suze", then "size") is acknowledged, not answered again. */
export const JOHNNY_ACKS = ["Got it, thank you.", "Understood.", "Right."];

/** Text that is a question to Johnny, not an answer to his question. */
export function isQuestion(text: string): boolean {
  const t = text.trim().replace(/^(i mean|so|and|but|ok(ay)?|well|also|just curious)[,\s]+/i, "");
  return (
    /\?|^(what|who|how|why|where|when|do|does|are|is|can|could|will|would|send|tell|please)\b/i.test(t) ||
    /\b(do|does|are|is|can|could|will|would) (you|u|y'?all|it|they|icfo)\b/i.test(t) ||
    /(not interested|no thanks|unsubscribe|remove me|\bbot\b|\brobot\b|\bhuman\b|\bcost\b|\bprice\b|\bfees?\b|commission)/i.test(t)
  );
}

/** Edit distance, for spotting a one word typo fix. */
function lev(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * A one or two word reply that fixes a word in one of the visitor's last
 * questions ("What kind of deal suze", then "Size"). Returns the question with
 * the word fixed, and the original question, or null.
 */
export function typoFix(text: string, earlier: string[]): { text: string; original: string } | null {
  const words = text.trim().toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 2 || /\d/.test(text)) return null;
  if (/^(yes|yeah|yep|yup|no|nope|ok|okay|sure|right|correct|thanks|thank you)$/.test(words.join(" "))) return null;
  const original = [...earlier].reverse().slice(0, 3).find(isQuestion);
  if (!original) return null;
  let hit = false;
  let parts = original.split(/\s+/);
  for (const w of words) {
    if (w.length < 4) continue;
    const tol = w.length <= 5 ? 1 : 2;
    const clean = (y: string) => y.toLowerCase().replace(/[^a-z]/g, "");
    if (parts.some((y) => clean(y) === w)) {
      hit = true;
      continue;
    }
    parts = parts.map((y) => {
      const yl = clean(y);
      if (!hit && yl.length > 3 && lev(yl, w) <= tol) {
        hit = true;
        return w;
      }
      return y;
    });
  }
  return hit ? { text: parts.join(" "), original } : null;
}
export const JOHNNY_OPTOUT_LINES = ["Understood, and thank you for telling me directly.", "I will not follow up with you. If that changes, you are always welcome here."];
