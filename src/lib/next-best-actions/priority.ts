import type { NextBestAction, NextBestActionPriority } from "@/lib/next-best-actions/types";

const PRIORITY_RANK: Record<NextBestActionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function priorityRank(priority: NextBestActionPriority): number {
  return PRIORITY_RANK[priority];
}

export function compareNextBestActions(a: NextBestAction, b: NextBestAction): number {
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;

  const urgencyA = a.urgencyAt ?? "";
  const urgencyB = b.urgencyAt ?? "";
  if (urgencyA && urgencyB) {
    const cmp = urgencyB.localeCompare(urgencyA);
    if (cmp !== 0) return cmp;
  } else if (urgencyB) {
    return 1;
  } else if (urgencyA) {
    return -1;
  }

  return a.title.localeCompare(b.title);
}

export function sortNextBestActions(actions: NextBestAction[]): NextBestAction[] {
  return [...actions].sort(compareNextBestActions);
}

export function dedupeNextBestActions(actions: NextBestAction[]): NextBestAction[] {
  const seen = new Set<string>();
  const result: NextBestAction[] = [];

  for (const action of sortNextBestActions(actions)) {
    const key = `${action.id}:${action.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }

  return result;
}

export function limitNextBestActions(actions: NextBestAction[], limit: number): NextBestAction[] {
  return dedupeNextBestActions(actions).slice(0, Math.max(1, limit));
}
