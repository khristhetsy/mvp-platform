/**
 * Conversation finder (Social Media Hub). Pure helpers, no IO, unit tested.
 *
 * Staff paste a link to a public conversation. The finder classifies who is talking
 * (founder or investor), checks it against the signal phrases, and picks a Reddit reply
 * template. It never posts. Replies are still written and posted by staff through the
 * existing Reddit reply composer, so the tracked link, the disclaimer and Attribution
 * all stay exactly as they are.
 */
import { REDDIT_TEMPLATES, isRedditThreadUrl } from "@/lib/social/reddit";

export type FinderPlatform = "reddit" | "linkedin" | "x";
export type FinderAudience = "founder" | "investor";
export type MatchLevel = "strong" | "good" | "review";
export type HitStatus = "new" | "replied" | "skipped" | "held";

export type FinderSignal = { id: string; phrase: string; platform: "any" | FinderPlatform; active: boolean };
export type FinderHit = {
  id: string;
  platform: FinderPlatform;
  thread_url: string;
  author_handle: string | null;
  excerpt: string;
  signal_id: string | null;
  audience: FinderAudience;
  match_level: MatchLevel;
  status: HitStatus;
  created_at: string;
};

export const FINDER_PLATFORM_LABEL: Record<FinderPlatform, string> = { reddit: "Reddit", linkedin: "LinkedIn", x: "X" };
export const MATCH_LABEL: Record<MatchLevel, string> = { strong: "Strong match", good: "Good match", review: "Staff review" };

/** Which platform a link belongs to, or null when it is none of the three. */
export function detectPlatform(url: string | null | undefined): FinderPlatform | null {
  let host: string;
  try {
    const u = new URL((url ?? "").trim());
    if (u.protocol !== "https:") return null;
    host = u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "reddit.com" || host === "old.reddit.com") return "reddit";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") return "x";
  return null;
}

/** Link check used before a hit is saved. Reddit links must be real thread links. */
export function validateThreadUrl(url: string | null | undefined): { ok: true; platform: FinderPlatform } | { ok: false; error: string } {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return { ok: false, error: "Paste a link to the conversation." };
  if (trimmed.length > 500) return { ok: false, error: "That link is too long." };
  const platform = detectPlatform(trimmed);
  if (!platform) return { ok: false, error: "Use an https link from Reddit, LinkedIn or X." };
  if (platform === "reddit" && !isRedditThreadUrl(trimmed)) return { ok: false, error: "Paste a Reddit thread link (reddit.com/r/…/comments/…)." };
  return { ok: true, platform };
}

const INVESTOR_VOICE = [
  /\bwe invest\b/i, /\bour fund\b/i, /\bour portfolio\b/i, /\bcheck size\b/i, /\bi invest\b/i,
  /\blooking at (early|seed|pre.?seed|series).{0,30}(deals|companies|startups)\b/i,
  /\b(angel|vc|lp|family office|limited partner)\b/i, /\bdeal ?flow\b/i, /\bour thesis\b/i,
];

/** Rule based guess at who is talking. Staff can override it before saving. */
export function classifyAudience(text: string): FinderAudience {
  const t = text ?? "";
  return INVESTOR_VOICE.some((re) => re.test(t)) ? "investor" : "founder";
}

/** The first active signal whose phrase appears in the text (platform "any" matches everywhere). */
export function matchSignal(text: string, platform: FinderPlatform, signals: FinderSignal[]): FinderSignal | null {
  const t = (text ?? "").toLowerCase();
  for (const s of signals) {
    if (!s.active) continue;
    if (s.platform !== "any" && s.platform !== platform) continue;
    if (t.includes(s.phrase.trim().toLowerCase())) return s;
  }
  return null;
}

/**
 * Match level, by rule. Investors always go to staff review (no public reply).
 * A founder with a signal match and a question is Strong, with a match is Good,
 * and with no match is left for staff review. No numeric score: there is no reply data yet.
 */
export function scoreHit(input: { audience: FinderAudience; matched: boolean; text: string }): MatchLevel {
  if (input.audience === "investor") return "review";
  if (!input.matched) return "review";
  return /\?/.test(input.text) ? "strong" : "good";
}

/** Investor hits are held: no public reply. Everything else starts new. */
export function initialStatus(audience: FinderAudience): HitStatus {
  return audience === "investor" ? "held" : "new";
}

/**
 * Which Reddit reply template fits the post. Defaults to the link free template,
 * which keeps the account in good standing when nothing else clearly fits.
 */
export function suggestTemplateKey(text: string): string {
  const t = (text ?? "").toLowerCase();
  const has = (k: string) => REDDIT_TEMPLATES.some((x) => x.key === k);
  if (has("no_replies") && /(no|zero|not getting|never got|didn.t get).{0,20}repl(y|ies)|cold email/.test(t)) return "no_replies";
  if (has("find_investors") && /(find|where to find|looking for|how do i get).{0,25}investors?/.test(t)) return "find_investors";
  if (has("deck_feedback") && /\bdeck\b|pitch/.test(t)) return "deck_feedback";
  return has("deck_feedback") ? "deck_feedback" : REDDIT_TEMPLATES[0].key;
}

/** Strip a pasted excerpt to something safe and short. */
export function cleanExcerpt(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
}
