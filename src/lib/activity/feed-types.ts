/**
 * The client-safe half of the activity feed.
 *
 * `feed.ts` is `server-only` because it reads Supabase with the service-role
 * client. The feed page's client component needs the row shape and the date
 * presets, and importing them from `feed.ts` pulled `server-only` into the
 * browser bundle — which fails the build rather than leaking, but fails it hard.
 * So the pure types and the date arithmetic live here and `feed.ts` re-exports
 * them, leaving one import path for server callers.
 */
import type {
  ActivityAudience,
  ActivityClassKey,
  ActivityStage,
} from "@/lib/activity/stages";

export type ActivityFeedItem = {
  id: string;
  classKey: ActivityClassKey | null;
  eventType: string;
  stage: ActivityStage | null;
  audience: ActivityAudience | null;
  severity: string;
  title: string;
  description: string | null;
  createdAt: string;
  actorName: string | null;
  actorRole: string | null;
  companyId: string | null;
  companyName: string | null;
  investorId: string | null;
  metadata: Record<string, unknown>;
};

export type ActivityStageGroup = {
  stage: ActivityStage;
  items: ActivityFeedItem[];
};

export type ActivityFeedFilters = {
  audience?: ActivityAudience | "both";
  /** Activity-type facet. Empty means every type. */
  classKeys?: ActivityClassKey[];
  from?: string | null;
  to?: string | null;
  companyId?: string | null;
  limit?: number;
};

export type ActivityFeedResult = {
  groups: ActivityStageGroup[];
  /** Every row in the window, ungrouped — the client filters this live. */
  items: ActivityFeedItem[];
  /** Rows in the window before the type facet was applied. */
  totalInWindow: number;
  /** Count per class in the window, for the facet's live numbers. */
  typeCounts: Record<string, number>;
};

/** Named date ranges, resolved server-side so the client sends one token. */
export const DATE_RANGES = ["today", "7d", "30d", "quarter", "year", "all", "custom"] as const;
export type DateRangeKey = (typeof DATE_RANGES)[number];

export const DATE_RANGE_LABEL: Record<DateRangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  quarter: "Quarter",
  year: "Year",
  all: "All time",
  custom: "Custom",
};

export function isDateRangeKey(value: string): value is DateRangeKey {
  return (DATE_RANGES as readonly string[]).includes(value);
}

export function resolveDateRange(
  key: DateRangeKey,
  custom?: { from?: string | null; to?: string | null },
  now: Date = new Date(),
): { from: string | null; to: string | null } {
  if (key === "custom") return { from: custom?.from ?? null, to: custom?.to ?? null };
  if (key === "all") return { from: null, to: null };

  const start = new Date(now);
  switch (key) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "quarter":
      start.setMonth(start.getMonth() - 3);
      break;
    case "year":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }
  return { from: start.toISOString(), to: null };
}
