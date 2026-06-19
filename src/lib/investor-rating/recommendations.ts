import { PILLAR_WEIGHTS, type PartnerScore } from "./types";

export type PartnerRecommendation = {
  pillar: keyof PartnerScore["pillars"] | "onboarding";
  /** Higher = more impactful to the overall score; used for ordering. */
  priority: number;
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};

/** A pillar below this is considered "worth improving". */
const IMPROVE_THRESHOLD = 70;

/**
 * Deterministic improvement nudges for an investor's own Partner Score.
 * Source of truth for the improvement panel — an AI layer (Phase 2) can phrase
 * these more warmly, but the substance comes from here. Grounded in the facts,
 * so suggestions are always specific and never hollow.
 */
export function buildPartnerRecommendations(score: PartnerScore): PartnerRecommendation[] {
  // New investors: focus on getting enough activity to be rated at all.
  if (score.status === "new") {
    return [
      {
        pillar: "onboarding",
        priority: 100,
        title: "Engage a few founders to get your Partner Score",
        detail:
          "Your score unlocks once you've engaged at least 3 founders. Browse dealflow and open conversations to start building your track record.",
        actionHref: "/investor/opportunities",
        actionLabel: "Browse dealflow",
      },
      {
        pillar: "credibility",
        priority: 90,
        title: "Complete your investor profile",
        detail:
          "Add your thesis, preferred sectors and stages, and check-size range so founders understand your fit.",
        actionHref: "/investor/settings",
        actionLabel: "Complete profile",
      },
    ];
  }

  const recs: PartnerRecommendation[] = [];
  const { pillars, facts } = score;

  function impact(pillar: keyof typeof PILLAR_WEIGHTS): number {
    return Math.round(PILLAR_WEIGHTS[pillar] * (100 - pillars[pillar]));
  }

  if (pillars.followThrough < IMPROVE_THRESHOLD) {
    const detail =
      facts.ghostRate > 0.2
        ? "You've expressed interest in companies you haven't followed up on. Open a deal room or message the founder to keep momentum."
        : "Convert more of your interest into deal rooms and honored pledges — follow-through is the biggest driver of your score.";
    recs.push({
      pillar: "followThrough",
      priority: impact("followThrough"),
      title: "Follow through on the deals you're interested in",
      detail,
      actionHref: "/investor/watchlist",
      actionLabel: "Review your watchlist",
    });
  }

  if (pillars.responsiveness < IMPROVE_THRESHOLD) {
    const detail =
      facts.replyRate < 0.6
        ? "Some founder messages are waiting on a reply. Responding — even briefly — within a couple of days strengthens your standing."
        : "Founders value fast replies. Tightening your response time lifts this part of your score.";
    recs.push({
      pillar: "responsiveness",
      priority: impact("responsiveness"),
      title: "Reply to founders more promptly",
      detail,
      actionHref: "/investor/messages",
      actionLabel: "Open messages",
    });
  }

  if (pillars.credibility < IMPROVE_THRESHOLD) {
    const detail = facts.accredited
      ? "Round out your profile — a clear thesis, sectors, stages, and check-size range help founders gauge fit."
      : "Complete verification and your investor profile (thesis, sectors, check size) to strengthen credibility.";
    recs.push({
      pillar: "credibility",
      priority: impact("credibility"),
      title: "Strengthen your investor profile",
      detail,
      actionHref: "/investor/settings",
      actionLabel: "Update profile",
    });
  }

  // Portfolio readiness and track record are descriptive / time-driven — no
  // actionable nudge, so they're intentionally omitted from recommendations.

  return recs.sort((a, b) => b.priority - a.priority);
}
