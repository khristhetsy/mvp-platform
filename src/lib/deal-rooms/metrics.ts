export type DealRoomEngagementSnapshot = {
  unresolvedCount: number;
  unresolvedQuestions: number;
  unresolvedDocRequests: number;
  lastActivityAt: string | null;
  responseTurnaroundHours: number | null;
  engagementScore: number;
};

function hoursBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, (b - a) / (1000 * 60 * 60));
}

export function computeEngagementSnapshot(input: {
  questions: Array<{ status: string; created_at: string; responded_at: string | null }>;
  docRequests: Array<{ status: string; created_at: string; fulfilled_at: string | null }>;
  activity: Array<{ created_at: string }>;
}): DealRoomEngagementSnapshot {
  const unresolvedQuestions = input.questions.filter((q) => q.status !== "resolved").length;
  const unresolvedDocRequests = input.docRequests.filter((r) => r.status !== "fulfilled" && r.status !== "cancelled").length;
  const unresolvedCount = unresolvedQuestions + unresolvedDocRequests;

  const lastActivityAt = input.activity[0]?.created_at ?? null;

  // median turnaround for responded questions
  const turnarounds = input.questions
    .filter((q) => q.responded_at)
    .map((q) => hoursBetween(q.created_at, q.responded_at as string))
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const responseTurnaroundHours =
    turnarounds.length === 0 ? null : turnarounds[Math.floor(turnarounds.length / 2)] ?? null;

  // Deterministic 0-100 score
  let score = 50;
  score -= Math.min(30, unresolvedCount * 6);
  if (responseTurnaroundHours != null) {
    score += responseTurnaroundHours <= 24 ? 20 : responseTurnaroundHours <= 72 ? 10 : 0;
  }
  // recent activity bonus (best-effort)
  if (lastActivityAt) {
    const hours = hoursBetween(lastActivityAt, new Date().toISOString());
    if (hours != null) {
      score += hours <= 24 ? 15 : hours <= 72 ? 5 : 0;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    unresolvedCount,
    unresolvedQuestions,
    unresolvedDocRequests,
    lastActivityAt,
    responseTurnaroundHours: responseTurnaroundHours != null ? Math.round(responseTurnaroundHours * 10) / 10 : null,
    engagementScore: score,
  };
}

