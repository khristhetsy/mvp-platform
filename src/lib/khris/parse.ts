import { isSideTalk, roleOf, stageOf, type Role, type Stage } from "@/lib/jessica2/parse";

/**
 * Khris chat reading on top of Jessica 2.0's parsers (lib/jessica2/parse, untouched).
 * These cover what real transcripts showed the 2.0 readers miss: "looking for
 * angel investors" is a founder, "no sales" is pre revenue, "how do you get
 * paud" is a fee question, and a visitor correcting the chat ("I don't write
 * checks, I'm seeking capital") switches the path.
 */

const low = (s: string) => s.toLowerCase().replace(/[’`]/g, "'");

/** Someone saying they are the company raising. */
export function founderSignal(text: string): boolean {
  return /seeking (capital|investors?|investment|funding|money)|seeing (funding|capital|investors)|looking for .{0,25}(investors?|funding|capital|money|angels?)|angel investors|need (capital|funding|investors|money|investment)|help (me|us) (with |get |find |raise )?(funding|raising|capital|investors|money)|i don'?t write checks?|not an investor|i'?m not investing|(we'?re|we are|i'?m|i am) raising/.test(low(text));
}

/** Someone saying they are the investor. */
export function investorSignal(text: string): boolean {
  return /\bi (write|invest)|i'?m an investor|i am an investor|\bwe invest|looking at deals|deal ?flow|\bmy fund\b/.test(low(text)) && !founderSignal(text);
}

/** Raising or investing. Founder phrases win before Jessica 2.0's reader runs; a question means "tell me more". */
export function khrisRoleOf(text: string): Role | "more" | null {
  if (founderSignal(text)) return "Raising";
  const r = roleOf(text);
  if (r) return r;
  if (/\?|^\s*(h[oi]w|what|wh?o|why|tell|explain)\b/.test(low(text))) return "more";
  return null;
}

/** Stage, with the ways people say "no revenue yet" that Jessica 2.0 reads as revenue. */
export function khrisStageOf(text: string): Stage | "revenue" | null {
  const l = low(text);
  if (/no (sales|revenue|customers)|zero (sales|revenue)|not (selling|making money)|revenue yet|sales yet|don'?t have (any )?(revenue|sales)|nothing yet/.test(l)) return "Pre revenue";
  return stageOf(text);
}

/** Questions and remarks to answer before going on, Jessica 2.0's list plus what Khris gets asked. */
export function isKhrisSideTalk(text: string): boolean {
  if (isSideTalk(text)) return true;
  return /back ?end|backed|contact|reach you|valuation|clients|what (kind|type|sort)s? of investors|(work|deal) with|too early|refund|money back|reference|past clients|other founders|how long|how fast|how quickly|timeline|make money|get pa(i|u)d|\bpa[iu]d\b|licen[sc]|registered|success rate|track record|how many investors|qualif|process|own (fund|money)|do you (guys )?(invest|fund)|are you (a |an )?(fund|vc)|not interested|how does|how do you|what do you/.test(low(text));
}

export type Topic =
  | "ai"
  | "name"
  | "license"
  | "broker"
  | "fund"
  | "investorsCount"
  | "refund"
  | "backend"
  | "contact"
  | "valuation"
  | "investorTypes"
  | "stageFit"
  | "references"
  | "timeline"
  | "successRate"
  | "process"
  | "makeMoney"
  | "upfront"
  | "commission"
  | "scam"
  | "guarantee"
  | "what"
  | "how"
  | "showMatch"
  | "notInterested"
  | "notFit"
  | "notNow"
  | "board"
  | "sendInfo"
  | "number"
  | "budget"
  | "cost"
  | "where"
  | "years"
  | "spv"
  | "thanks"
  | "hello";

/** Which written answer a remark gets, in the order they are checked. Null: the AI answers it. */
export function topicOf(text: string): Topic | null {
  const l = low(text);
  if (/\b(bot|robot|chatgpt|automated|real person|actual person|human)\b|are you (an? )?(ai|a\.i\.)\b/.test(l)) return "ai";
  if (/(your|ur) name|who am i (talking|chatting|speaking)|who (is|are) (this|you)\b/.test(l)) return "name";
  if (/licen[sc]|registered|regulated/.test(l)) return "license";
  if (/\bbroker|dealer\b|finra/.test(l)) return "broker";
  if (/(do|will) you (guys )?(invest|fund)|your own (fund|money|capital|f\w+d)|do you (have|run) a fund|are you (an? )?(investor|vc|fund)\b/.test(l)) return "fund";
  if (/how many investors|how big.{0,15}network|size of (your|the) network|number of investors/.test(l)) return "investorsCount";
  if (/back ?-?end|backed|success (fee|based)|only (pay|paid) (if|when|after)|contingen|after (we|i) (raise|close)|\bdefer|equity instead|work (something|it) out/.test(l)) return "backend";
  if (/your (contact|email|e-mail|phone|number|direct line)|contact (info|details)|reach you|call you|get in touch/.test(l)) return "contact";
  if (/valuation|valuate|value (my|our|the) company|what.{0,10}worth/.test(l)) return "valuation";
  if (/refund|money back|if (we|i) (don'?t|do not|never) (raise|get funded|close)|what if (it|we|this) (fails?|doesn'?t work)/.test(l)) return "refund";
  if (/references?\b|previous clients|former clients|your clients|past clients|other founders|testimonial|case stud|who (have|did) you (help|work)|clients you'?ve|talk to (a |some )?(client|founder)/.test(l)) return "references";
  if (/how long (does|will|would|to|until)|take to (raise|close|get funded)|how (fast|quickly)|timeline|time ?frame|how soon (can|could|will)/.test(l)) return "timeline";
  if (/success rate|hit rate|close rate|how many (deals|companies|raises)|track record|\bresults\b/.test(l)) return "successRate";
  if (/make money|get pa(i|u)d|how (are|do) you (get )?pa(i|u)d|how do you charge/.test(l)) return "makeMoney";
  if (/(don'?t|do not|won'?t|will not|never|not going to|refuse to) (want to )?pay|no (upfront|up front) fees?|not paying|(upfront|up front) fees?|pa(y|id) (upfront|up front)/.test(l)) return "upfront";
  if (/qualif|criteria|\bvet\b|screen/.test(l)) return "process";
  if (/commission|success fee|finder'?s? fee|cut of/.test(l)) return "commission";
  if (/scam|legit|fake|rip ?off|dropped the ball|waste of time|didn'?t deliver|never delivered/.test(l)) return "scam";
  if (/guarantee|promise|will (we|i) get funded|sure (we|i) (get|raise)/.test(l)) return "guarantee";
  if (/what do you (guys )?do|what does icfo|what (is|does) (your|the) (company|firm)|who are you guys|do for the company/.test(l)) return "what";
  if (/how does (it|this|that|the \w+|your \w+) work|h[oi]w do(es)? (you|your|it)|what'?s the process|what are the steps/.test(l)) return "how";
  if (/what (kind|type|sort)s? of investors|who are (your|the) investors|what investors do you/.test(l)) return "investorTypes";
  if (/(work|deal) with (pre ?-?revenue|early|startups?|idea stage|small)|pre ?-?revenue (companies|startups)|too early (for you)?\b/.test(l)) return "stageFit";
  if (/show (me )?(the |a |my )?match|match(ed)? investors|who (are|would be) the investors|which investors|see (the )?investors/.test(l)) return "showMatch";
  if (/not interested|no thanks|not for (me|us)\b/.test(l)) return "notInterested";
  if (/not a fit|doesn'?t fit|not (the )?right fit/.test(l)) return "notFit";
  if (/don'?t want to (schedule|book)|not (ready|yet)\b|no meeting|not now|maybe later|just (looking|browsing)/.test(l)) return "notNow";
  if (/\b(board|my team|partners?|co-?founders?|think about it|talk it over|discuss)\b/.test(l)) return "board";
  if (/send (me |us )?(some |more |your |the )?(info|information|details|deck|material)|email me|more info/.test(l)) return "sendInfo";
  if (/give me a number|ball ?park|straight answer|just tell me/.test(l)) return "number";
  if (/no budget|can'?t afford|too expensive|don'?t have (the )?(money|budget)/.test(l)) return "budget";
  if (/\b(cost|costs|price|pricing|fees?|how much|charge|charges|upfront|up front|retainer)\b/.test(l)) return "cost";
  if (/where (are you|is icfo|are you guys) (based|located)|what city|\boffices?\b/.test(l)) return "where";
  if (/how long have you|been (around|in business|doing this)|since when|how many years/.test(l)) return "years";
  if (/\bspv\b/.test(l)) return "spv";
  if (/^(thanks|thank you|thx|cheers)\b/.test(l)) return "thanks";
  if (/^(hi|hello|hey|bonjour)\b/.test(l) && l.length < 20) return "hello";
  return null;
}
