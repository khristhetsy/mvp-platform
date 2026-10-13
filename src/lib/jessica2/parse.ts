import type { FitAnswers } from "@/lib/fit/options";
import { groupSectors, valuesForChips } from "@/lib/fit/sector-groups";
import type { Slot } from "@/lib/jessica/flow";

/**
 * Jessica 2.0 reads typed answers, not button taps. Every helper here turns what
 * a visitor typed into one of the buckets the conversation (and /fit matching)
 * works with, or null when it can't tell. Null is never guessed around: the chat
 * asks a short check question instead.
 */

export type Role = "Raising" | "Investing";
export const STAGES = ["Pre revenue", "Under $1M a year", "$1M to $5M a year", "Over $5M a year"] as const;
export const RAISES = ["Under $1M", "$1M to $5M", "$5M to $20M", "Over $20M"] as const;
export const TIMINGS = ["Within 30 days", "A few months", "Not sure yet"] as const;
export const CHECKS = ["Under $250K", "$250K to $1M", "$1M to $5M", "$5M plus"] as const;
export type Stage = (typeof STAGES)[number];
export type Raise = (typeof RAISES)[number];
export type Timing = (typeof TIMINGS)[number];
export type Check = (typeof CHECKS)[number];

export interface Industry {
  /** What Jessica says back, in plain words. */
  label: string;
  /** /fit sector chip labels (see lib/fit/sector-groups) this industry matches on. */
  chips: string[];
}

export interface Jessica2Profile {
  role?: Role;
  stage?: Stage;
  industry?: Industry;
  /** Exactly what the visitor typed for industry, kept for the booking. */
  industryText?: string;
  raise?: Raise;
  timing?: Timing;
  check?: Check;
}

const low = (s: string) => s.toLowerCase().replace(/[’`]/g, "'");

/** Raising or investing, from a free sentence. Founder signals win: "seeking investment" is a founder. */
export function roleOf(text: string): Role | "more" | null {
  const l = low(text);
  const founder =
    /\brais|start ?-?ups?\b|starups?|my (company|business|startup|firm)|our (company|business|startup)|\bseek|looking for (funding|investment|investors|capital|money)|need (funding|capital|money|investors|investment)|\bfunding\b|founder|\bceo\b|pitch/.test(l);
  if (founder) return "Raising";
  const investor = /write checks?|looking at deals|deal ?flow|\bi invest|\bwe invest|an investor|\binvestor\b|\binvesting\b|deploy|allocat|family office|\bvc\b|fund manager|\bangel\b|\bdeals?\b/.test(l);
  if (investor) return "Investing";
  if (/\b(more|what|tell|explain|who are you|what do you do)\b/.test(l)) return "more";
  return null;
}

const UNIT: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mn: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };

/**
 * The largest amount in the text, in dollars. "1 to 2M" reads as 2M (the unit
 * carries back). A bare small number with no unit anywhere ("1n", "5") is
 * ambiguous and returns null.
 */
export function moneyIn(text: string): number | null {
  const tokens = [...low(text).replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(k|thousand|mm|mn|mil|million|m|bn|billion|b)?\b/g)];
  if (tokens.length === 0) return null;
  let lastUnit: number | null = null;
  const values: (number | null)[] = new Array(tokens.length).fill(null);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const n = parseFloat(tokens[i][1]);
    const u = tokens[i][2] ? UNIT[tokens[i][2]] : null;
    if (u) lastUnit = u;
    const mult = u ?? lastUnit;
    if (mult) values[i] = n * mult;
    else if (n >= 1000) values[i] = n;
  }
  const ok = values.filter((v): v is number => v !== null);
  return ok.length ? Math.max(...ok) : null;
}

/** "1n", "$5", "2" with no unit: the number to check with the visitor ("1 million?"). */
export function bareNumber(text: string): string | null {
  if (moneyIn(text) !== null) return null;
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m && parseFloat(m[1]) < 1000 ? m[1] : null;
}

export function stageOf(text: string): Stage | "revenue" | null {
  const l = low(text);
  if (/pre ?-?revenue|no revenue|zero revenue|not (making|earning) (any )?(money|revenue)|haven'?t (made|got) (any )?(money|revenue)|idea stage|prototype|\bmvp\b|pre ?-?launch/.test(l)) return "Pre revenue";
  const n = moneyIn(l);
  if (n !== null) return n < 1e6 ? "Under $1M a year" : n <= 5e6 ? "$1M to $5M a year" : "Over $5M a year";
  if (/revenue|making money|profitable|sales|customers|selling/.test(l)) return "revenue";
  return null;
}

export function raiseOf(text: string): Raise | null {
  const n = moneyIn(text);
  if (n === null) return null;
  return n < 1e6 ? "Under $1M" : n <= 5e6 ? "$1M to $5M" : n <= 20e6 ? "$5M to $20M" : "Over $20M";
}

export function checkOf(text: string): Check | null {
  const n = moneyIn(text);
  if (n === null) return null;
  return n < 250e3 ? "Under $250K" : n <= 1e6 ? "$250K to $1M" : n <= 5e6 ? "$1M to $5M" : "$5M plus";
}

export function timingOf(text: string): Timing | null {
  const l = low(text);
  if (/not sure|don'?t know|no idea|depends|unsure|whenever|no rush/.test(l)) return "Not sure yet";
  if (/\bweeks?\b|30 days|this month|asap|as soon as|\bsoon\b|\bnow\b|immediately|urgent|right away|yesterday/.test(l)) return "Within 30 days";
  if (/months?|quarter|\bq[1-4]\b|later this year|next year|end of (the )?year|this year|\bspring|\bsummer|\bfall|\bautumn|\bwinter/.test(l)) return "A few months";
  return null;
}

const INDUSTRY_RULES: Array<[RegExp, string[]]> = [
  [/solar|clean ?-?tech|climate|sustainab|carbon|renewable|\bev\b|electric vehicle|batter(y|ies)|green energy|wind/, ["Cleantech and Climate", "Energy and Resources"]],
  [/\benergy|oil|\bgas\b|nuclear|mining/, ["Energy and Resources", "Cleantech and Climate"]],
  [/\biot\b|data/, ["Data and IoT", "Software and SaaS"]],
  [/medical device|med ?tech|medtech|device/, ["Medical Devices", "Healthcare"]],
  [/bio|pharma|life science|therapeutic|drug/, ["Biotech and Life Sciences", "Healthcare"]],
  [/health|clinic|medical|hospital|wellness|care\b/, ["Healthcare", "Medical Devices"]],
  [/fin ?tech|payment|banking app|neobank/, ["Fintech and Payments", "Financial Services and Insurance"]],
  [/insur|financial services|lending|\bbank|wealth|credit/, ["Financial Services and Insurance", "Fintech and Payments"]],
  [/crypto|blockchain|web3|bitcoin|defi/, ["Crypto and Web3"]],
  [/cyber|security/, ["Cybersecurity"]],
  [/\bai\b|a\.i\.|artificial intelligence|machine learning|\bml\b|\bllm/, ["AI and Machine Learning", "Software and SaaS"]],
  [/robot|hardware|semiconductor|chip|deep ?tech|drone|automation/, ["Deep Tech and Hardware"]],
  [/telecom|5g|wireless/, ["Telecom"]],
  [/aero|space|defen[cs]e/, ["Aerospace and Defense"]],
  [/logistic|transport|supply chain|shipping|freight|mobility|delivery/, ["Transportation and Logistics"]],
  [/manufactur|industrial|construction|materials|factory/, ["Manufacturing and Industrial"]],
  [/agri|farm|agtech|crop/, ["Agriculture and AgTech"]],
  [/food|restaurant|beverage|drink|hospitality|hotel|coffee/, ["Food and Hospitality", "Consumer Products"]],
  [/apparel|fashion|clothing|footwear/, ["Apparel", "Consumer Products"]],
  [/e ?-?commerce|marketplace|\bdtc\b|online store/, ["E-commerce and Marketplaces", "Consumer Products"]],
  [/media|entertainment|gaming|game|film|music|streaming|sport/, ["Media, Entertainment and Gaming"]],
  [/edtech|education|learning|school/, ["Education"]],
  [/travel|tourism/, ["Travel"]],
  [/cannabis|cbd/, ["Cannabis"]],
  [/real estate|property|proptech|housing/, ["Real Estate"]],
  [/consult|services|staffing|agency|recruit/, ["Business and Professional Services"]],
  [/consumer|retail|\bcpg\b|beauty|cosmetic|pet/, ["Consumer Products"]],
  [/software|saas|\bapp\b|platform|\btech\b|technology|web|mobile/, ["Software and SaaS", "AI and Machine Learning"]],
];

/** Industry from free text, mapped onto /fit sector chips. Null when nothing matches. */
export function industryOf(text: string): Industry | null {
  const l = low(text);
  for (const [re, chips] of INDUSTRY_RULES) {
    if (re.test(l)) {
      const said = text.trim().replace(/^(we'?re|we are|i'?m|i am|it'?s|in|we do|mostly|into)\s+/i, "").replace(/[.!]+$/, "");
      const label = said.length > 0 && said.length <= 40 && !/\b(we|i|our)\b/i.test(said) ? said.toLowerCase() : chips[0].toLowerCase();
      return { label, chips };
    }
  }
  return null;
}

export function yesNo(text: string): "yes" | "no" | null {
  const l = low(text).trim();
  if (/^(no|nope|nah|not (now|yet|really)|later|maybe later|keep chatting|i'?m good|pass)\b/.test(l)) return "no";
  if (/^(y|yes|yeah|yep|yup|sure|ok|okay|please|show|go ahead|do it|let'?s|absolutely|of course|definitely|why not|sounds good|great|perfect)\b/.test(l)) return "yes";
  return null;
}

/**
 * Text that is a question, an objection or a fee or trust remark, not an answer.
 * These get answered first, then Jessica comes back to what she asked.
 */
export function isSideTalk(text: string): boolean {
  const l = low(text);
  return (
    /\?/.test(l) ||
    /\b(fees?|costs?|price|pricing|charge|upfront|up front|retainer|commission|broker|scam|legit|fake|guarantee|bot|robot|real person|are you (an? )?(ai|human|real|person)|send (me|us)|info|information|deck|not interested|no thanks|too expensive|no budget|can'?t afford|don'?t pay|won'?t pay|not paying|who are you|what do you do|how does (it|this) work|not a fit|my board|my partner|co-?founder|success rate|case stud(y|ies)|references?|testimonials?|time ?line|how long)\b/.test(l)
  );
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface TimeRequest {
  weekday?: number;
  tomorrow?: boolean;
  /** Minutes after midnight, Pacific. */
  minutes?: number;
  part?: "morning" | "afternoon" | "evening";
}

/** "Friday 2pm PT", "tomorrow morning", "wed at 10:30" → what was asked for. Null when no day or time is in it. */
export function timeRequestOf(text: string): TimeRequest | null {
  const l = low(text);
  const req: TimeRequest = {};
  const wd = l.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|sday|rsday|urday)?\b/);
  if (wd) req.weekday = WEEKDAYS.indexOf(wd[1].slice(0, 3));
  if (/\btomorrow\b/.test(l)) req.tomorrow = true;
  const t = l.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?!\s*(k|m|million|%))\b/);
  if (t && (t[2] || t[3] || /\bat\s+\d/.test(l))) {
    let h = parseInt(t[1], 10);
    const min = t[2] ? parseInt(t[2], 10) : 0;
    const ap = t[3]?.replace(/\./g, "");
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 6) h += 12; // "at 2" means 2 PM in a business day
    if (h <= 23 && min <= 59) req.minutes = h * 60 + min;
  }
  if (/\bmorning\b/.test(l)) req.part = "morning";
  else if (/\bafternoon\b|\bnoon\b/.test(l)) req.part = "afternoon";
  else if (/\bevening\b|\btonight\b/.test(l)) req.part = "evening";
  return req.weekday !== undefined || req.tomorrow || req.minutes !== undefined || req.part ? req : null;
}

/** Weekday (0 Sunday) and minutes after midnight of an instant in `timeZone`. */
export function zonedParts(iso: string, timeZone: string): { weekday: number; minutes: number; dayKey: string } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: WEEKDAYS.indexOf(get("weekday").toLowerCase().slice(0, 3)),
    minutes: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10),
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export type SlotAnswer =
  | { kind: "exact"; slot: Slot }
  | { kind: "options"; slots: Slot[]; full: boolean }
  | { kind: "none" };

/**
 * Find what a visitor asked for among the open slots. An exact hit books it;
 * otherwise up to three of the closest times that day; a full day gives the
 * next open times instead.
 */
export function slotsFor(req: TimeRequest, slots: Slot[], timeZone: string, now = new Date()): SlotAnswer {
  const sorted = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).filter((s) => Date.parse(s.start) > now.getTime());
  if (sorted.length === 0) return { kind: "none" };
  let weekday = req.weekday;
  if (req.tomorrow) weekday = (zonedParts(now.toISOString(), timeZone).weekday + 1) % 7;
  const inPart = (m: number) => !req.part || (req.part === "morning" ? m < 720 : req.part === "afternoon" ? m >= 720 && m < 1020 : m >= 1020);
  let pool = sorted.filter((s) => {
    const p = zonedParts(s.start, timeZone);
    return (weekday === undefined || p.weekday === weekday) && inPart(p.minutes);
  });
  if (weekday !== undefined && pool.length) {
    const firstDay = zonedParts(pool[0].start, timeZone).dayKey;
    pool = pool.filter((s) => zonedParts(s.start, timeZone).dayKey === firstDay);
  }
  if (pool.length === 0) return { kind: "options", slots: sorted.slice(0, 2), full: true };
  if (req.minutes !== undefined) {
    const exact = pool.find((s) => zonedParts(s.start, timeZone).minutes === req.minutes);
    if (exact) return { kind: "exact", slot: exact };
    const near = [...pool].sort((a, b) => Math.abs(zonedParts(a.start, timeZone).minutes - req.minutes!) - Math.abs(zonedParts(b.start, timeZone).minutes - req.minutes!));
    return { kind: "options", slots: near.slice(0, 2).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), full: false };
  }
  if (pool.length === 1) return { kind: "exact", slot: pool[0] };
  const spread = pool.length <= 3 ? pool : [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]];
  return { kind: "options", slots: spread, full: false };
}

/** Ways of saying "not those times". */
export function declinesTimes(text: string): boolean {
  return /can'?t|cannot|don'?t work|doesn'?t work|won'?t work|no good|not good|busy|neither|none of|another|other (day|time)|different|those days|not available|unavailable/.test(low(text));
}

/** /fit's Q1 answer behind each of Jessica's stage buckets (mirrors Q1_COMPANY in app/fit/FitFunnelV2). */
const STAGE_FIT: Record<Stage, { stage: string[]; revenue: string[] }> = {
  "Pre revenue": { stage: ["pre_revenue"], revenue: ["pre_revenue"] },
  "Under $1M a year": { stage: ["revenue_pre_a"], revenue: ["under_1m"] },
  "$1M to $5M a year": { stage: ["revenue_pre_a"], revenue: ["1m_5m"] },
  "Over $5M a year": { stage: ["series_a_plus"], revenue: ["over_5m"] },
};
const RAISE_FIT: Record<Raise, string[]> = {
  "Under $1M": ["under_1m"],
  "$1M to $5M": ["1m_10m"],
  "$5M to $20M": ["1m_10m", "over_10m"],
  "Over $20M": ["over_10m"],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The /fit match request for what the founder told Jessica. `sectors` is the
 * offerable list from /api/fit/sectors. Null until stage, industry and raise are known.
 */
export function fitAnswersFor(p: Jessica2Profile, sectors: string[]): FitAnswers | null {
  if (!p.stage || !p.raise || sectors.length === 0) return null;
  const groups = groupSectors(sectors);
  let industry = p.industry ? valuesForChips(groups, p.industry.chips.map(slug)) : [];
  if (industry.length === 0) industry = sectors.slice(0, 60);
  return {
    stage: STAGE_FIT[p.stage].stage,
    raise: RAISE_FIT[p.raise],
    industry: industry.slice(0, 60),
    revenue: STAGE_FIT[p.stage].revenue,
    investorType: ["any"],
  };
}

/** A name for the calendar invite from the email, since Jessica doesn't ask for one. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._\-+]+/).map((w) => w.replace(/\d+/g, "")).filter((w) => w.length > 1);
  const name = words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return name || "Guest";
}

export function validPhone(text: string): boolean {
  const digits = text.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15 && text.length <= 40;
}

/** True when at least one investor in the network covers this industry (so Jessica can say so). */
export function coveredBy(industry: Industry, sectors: string[]): boolean {
  if (industry.chips.length === 0 || sectors.length === 0) return false;
  return valuesForChips(groupSectors(sectors), industry.chips.map(slug)).length > 0;
}
