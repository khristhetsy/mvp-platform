export type InsightLevel = "critical" | "warning" | "opportunity" | "positive";

export type FounderInsight = {
  id: string;
  level: InsightLevel;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  /** Human-readable age label, e.g. "Day 8" */
  age?: string;
};

type Room = { id: string; title: string; status: string; updated_at: string };

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

const PRIORITY: Record<InsightLevel, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  positive: 3,
};

export function computeFounderInsights(input: {
  rooms: Room[];
  unresolvedQCount: number;
  readinessScore: number;
  strongMatchCount: number;
}): FounderInsight[] {
  const { rooms, unresolvedQCount, readinessScore, strongMatchCount } = input;
  const insights: FounderInsight[] = [];

  /* ── 1. Stale deal rooms ── */
  for (const room of rooms) {
    const days = daysSince(room.updated_at);
    if (days >= 8) {
      insights.push({
        id: `stale-room-${room.id}`,
        level: "critical",
        title: "Deal room going cold",
        body: `"${room.title}" has had no activity for ${days} days. Investors who disengage at this stage rarely re-engage — this is the critical window to reach out.`,
        cta: { label: "View room", href: `/founder/deal-room/${room.id}` },
        age: `Day ${days}`,
      });
    } else if (days >= 4) {
      insights.push({
        id: `quiet-room-${room.id}`,
        level: "warning",
        title: "Room quiet for several days",
        body: `"${room.title}" hasn't had activity in ${days} days. A quick check-in now keeps momentum before it stalls.`,
        cta: { label: "View room", href: `/founder/deal-room/${room.id}` },
        age: `Day ${days}`,
      });
    }
  }

  /* ── 2. Unresolved investor questions ── */
  if (unresolvedQCount > 0) {
    insights.push({
      id: "unresolved-questions",
      level: "warning",
      title: `${unresolvedQCount} investor question${unresolvedQCount === 1 ? "" : "s"} unanswered`,
      body: "Founders who respond within 24h are 3× more likely to advance to a term sheet conversation. Investors notice response speed.",
      cta: { label: "View deal rooms", href: "/founder/deal-room" },
    });
  }

  /* ── 3. Readiness score ── */
  if (readinessScore < 65) {
    insights.push({
      id: "low-readiness",
      level: "warning",
      title: "Score below institutional threshold",
      body: `Your readiness score is ${readinessScore}/100. Most institutional investors require 80+ before scheduling a first meeting — targeted actions can move this quickly.`,
      cta: { label: "Improve readiness", href: "/founder/readiness" },
    });
  } else if (readinessScore < 80) {
    insights.push({
      id: "near-threshold",
      level: "opportunity",
      title: `${80 - readinessScore} points from 80 — the institutional threshold`,
      body: `You're at ${readinessScore}/100. Crossing 80 opens the door to more institutional conversations. Here's exactly what to complete.`,
      cta: { label: "See what's missing", href: "/founder/readiness/missing" },
    });
  }

  /* ── 4. Strong matches not yet contacted ── */
  if (strongMatchCount > 0) {
    insights.push({
      id: "uncontacted-matches",
      level: "opportunity",
      title: `${strongMatchCount} strong investor match${strongMatchCount === 1 ? "" : "es"} to contact`,
      body: "Strong matches convert best when contacted within 14 days. The longer you wait, the more other founders fill the investor's pipeline.",
      cta: { label: "View matches", href: "/founder/investors/matches" },
    });
  }

  /* ── 5. Positive fallback ── */
  if (insights.length === 0) {
    insights.push({
      id: "all-good",
      level: "positive",
      title: "You're on track",
      body: "No urgent items right now. Keep your deal rooms active and your readiness score climbing — consistent progress is what investors notice over time.",
    });
  }

  return insights.sort((a, b) => PRIORITY[a.level] - PRIORITY[b.level]);
}
