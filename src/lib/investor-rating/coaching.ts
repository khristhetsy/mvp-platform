import { CLAUDE_HAIKU, claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { buildPartnerRecommendations, type PartnerRecommendation } from "./recommendations";
import type { PartnerScore } from "./types";

export type PartnerCoaching = {
  summary: string;
  recommendations: PartnerRecommendation[];
  source: "ai" | "fallback";
};

const SYSTEM_PROMPT = `You are a supportive coach helping an investor be a stronger partner to founders on CapitalOS.

Write a short (2–3 sentence) encouraging paragraph based ONLY on the facts and suggested actions provided.

Rules:
- Do NOT invent numbers, outcomes, or guarantees — use only what is provided.
- Never promise results (e.g. "you'll get more deals"). Keep it about behavior.
- Frame positively — coaching, not criticism.
- Reference the suggested actions concretely.
- Plain prose only, no markdown, no lists.`;

/** Deterministic summary used when AI is unavailable or fails. */
export function fallbackCoachingSummary(recommendations: PartnerRecommendation[]): string {
  if (recommendations.length === 0) {
    return "You're showing up as a strong partner — keep engaging founders and following through on the deals you're interested in.";
  }
  const top = recommendations.slice(0, 2).map((r) => r.title.toLowerCase());
  const joined = top.length === 2 ? `${top[0]}, and ${top[1]}` : top[0];
  return `To strengthen your Partner Score, focus on these: ${joined}.`;
}

function buildContext(score: PartnerScore, recs: PartnerRecommendation[]): string {
  const header =
    score.status === "new"
      ? "Status: new investor, not yet rated (building history)."
      : `Partner Score: ${score.score}/100 (tier: ${score.tier}).`;
  return [
    header,
    `Pillars — follow-through ${Math.round(score.pillars.followThrough)}, responsiveness ${Math.round(
      score.pillars.responsiveness,
    )}, credibility ${Math.round(score.pillars.credibility)}.`,
    `Reply rate ${Math.round(score.facts.replyRate * 100)}%, deal conversion ${Math.round(
      score.facts.conversionRate * 100,
    )}%.`,
    "Suggested actions:",
    ...recs.map((r) => `- ${r.title}: ${r.detail}`),
  ].join("\n");
}

/**
 * Hybrid coaching: deterministic recommendations are the source of truth; an
 * optional AI layer (Haiku) phrases them warmly. Falls back to a deterministic
 * summary when Claude is unavailable or errors — so it always returns something.
 */
export async function buildPartnerCoaching(score: PartnerScore): Promise<PartnerCoaching> {
  const recommendations = buildPartnerRecommendations(score);

  if (!isClaudeConfigured()) {
    return { summary: fallbackCoachingSummary(recommendations), recommendations, source: "fallback" };
  }

  try {
    const text = await claudeComplete(
      [{ role: "user", content: `Coach this investor based on the data:\n\n${buildContext(score, recommendations)}` }],
      { model: CLAUDE_HAIKU, maxTokens: 220, system: SYSTEM_PROMPT },
    );
    const summary = text.trim();
    if (!summary) {
      return { summary: fallbackCoachingSummary(recommendations), recommendations, source: "fallback" };
    }
    return { summary, recommendations, source: "ai" };
  } catch {
    return { summary: fallbackCoachingSummary(recommendations), recommendations, source: "fallback" };
  }
}
