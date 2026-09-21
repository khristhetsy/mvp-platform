/**
 * Reading the account-activity feed.
 *
 * Separate from `event-queries.ts` because that one serves the 0044 operational
 * feed — all thirteen categories, staff and system rows included. This one is
 * only the founder and investor rows, folded by stage, filtered by a date
 * window and by activity type.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  ACTIVITY_CLASSES,
  type ActivityAudience,
  type ActivityClassKey,
  type ActivityStage,
  activityClass,
  activityEventType,
  classKeyFromEventType,
  isActivityStage,
  stagesFor,
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

export type ActivityFeedFilters = {
  audience?: ActivityAudience | "both";
  /** Activity-type facet. Empty means every type. */
  classKeys?: ActivityClassKey[];
  from?: string | null;
  to?: string | null;
  companyId?: string | null;
  limit?: number;
};

export type ActivityStageGroup = {
  stage: ActivityStage;
  items: ActivityFeedItem[];
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

export const DATE_RANGE_LABEL: Record<DateRangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  quarter: "Quarter",
  year: "Year",
  all: "All time",
  custom: "Custom",
};

const DEFAULT_LIMIT = 300;

export async function loadActivityFeed(
  filters: ActivityFeedFilters = {},
): Promise<ActivityFeedResult> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const audience = filters.audience ?? "founder";

  // Only OUR event types. The 0044 rows (digest_generated, workflow_blocked and
  // the rest) are staff and system activity, not account activity, and mixing
  // them in would make the stage folds meaningless.
  const ourTypes = ACTIVITY_CLASSES.filter((c) => {
    if (audience === "both") return true;
    return stagesFor(audience).includes(c.stage);
  }).map((c) => activityEventType(c.key));

  let query = admin
    .from("operational_activity_events")
    .select(
      "id, event_type, activity_stage, activity_audience, severity, title, description, created_at, actor_user_id, actor_role, company_id, investor_id, metadata",
    )
    .in("event_type", ourTypes)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? DEFAULT_LIMIT);

  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }
  if (filters.companyId) query = query.eq("company_id", filters.companyId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Unable to load account activity: ${error.message}`);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Type counts are computed over the WHOLE window, before the facet narrows
  // it — otherwise the number beside each type would always be the number you
  // already selected.
  const typeCounts: Record<string, number> = {};
  for (const row of rows) {
    const key = classKeyFromEventType(String(row.event_type));
    if (!key) continue;
    typeCounts[key] = (typeCounts[key] ?? 0) + 1;
  }

  const facet = new Set(filters.classKeys ?? []);
  const kept = facet.size
    ? rows.filter((row) => {
        const key = classKeyFromEventType(String(row.event_type));
        return key ? facet.has(key) : false;
      })
    : rows;

  // Names are resolved in two batched reads rather than a join, matching the
  // pattern in event-queries.ts.
  const actorIds = [...new Set(kept.map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const companyIds = [...new Set(kept.map((r) => r.company_id).filter(Boolean))] as string[];

  const typed = createServiceRoleClient();
  const [actors, companies] = await Promise.all([
    actorIds.length
      ? typed.from("profiles").select("id, full_name, email").in("id", actorIds)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? typed.from("companies").select("id, company_name").in("id", companyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const actorMap = new Map(
    ((actors.data ?? []) as Array<Record<string, unknown>>).map((r) => [
      String(r.id),
      (r.full_name as string | null) ?? (r.email as string | null),
    ]),
  );
  const companyMap = new Map(
    ((companies.data ?? []) as Array<Record<string, unknown>>).map((r) => [
      String(r.id),
      r.company_name as string,
    ]),
  );

  const items: ActivityFeedItem[] = kept.map((row) => {
    const stageRaw = row.activity_stage ? String(row.activity_stage) : null;
    return {
      id: String(row.id),
      classKey: classKeyFromEventType(String(row.event_type)),
      eventType: String(row.event_type),
      stage: stageRaw && isActivityStage(stageRaw) ? stageRaw : null,
      audience: (row.activity_audience as ActivityAudience | null) ?? null,
      severity: String(row.severity ?? "info"),
      title: String(row.title ?? ""),
      description: (row.description as string | null) ?? null,
      createdAt: String(row.created_at),
      actorName: row.actor_user_id ? (actorMap.get(String(row.actor_user_id)) ?? null) : null,
      actorRole: (row.actor_role as string | null) ?? null,
      companyId: (row.company_id as string | null) ?? null,
      companyName: row.company_id ? (companyMap.get(String(row.company_id)) ?? null) : null,
      investorId: (row.investor_id as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    };
  });

  // Fold by stage. Every stage of the audience gets a group even when empty —
  // an empty fold says "nothing happened here", which is information; a missing
  // fold just looks like the stage does not exist.
  const stages: ActivityStage[] =
    audience === "both"
      ? [...stagesFor("founder"), ...stagesFor("investor")]
      : [...stagesFor(audience)];

  const groups: ActivityStageGroup[] = stages.map((stage) => ({
    stage,
    items: items.filter((item) => {
      if (item.stage) return item.stage === stage;
      // A row with no stage stamp predates the column, or its account had no
      // stage at the time. Fall back to the class's own stage rather than
      // dropping it out of the feed entirely.
      const cls = item.classKey ? activityClass(item.classKey) : null;
      return cls?.stage === stage;
    }),
  }));

  return { groups, items, totalInWindow: rows.length, typeCounts };
}

/**
 * How much of the platform actually reports activity.
 *
 * Shown as a coverage tile because the honest answer at launch is "hardly any",
 * and a feed that looks empty without saying why reads as broken rather than
 * uninstrumented.
 */
export async function activityCoverage(): Promise<{
  instrumentedClasses: number;
  totalClasses: number;
  classesSeen: number;
}> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from("operational_activity_events")
    .select("event_type")
    .not("activity_stage", "is", null)
    .limit(2000);

  const seen = new Set<string>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const key = classKeyFromEventType(String(row.event_type));
    if (key) seen.add(key);
  }

  return {
    instrumentedClasses: seen.size,
    totalClasses: ACTIVITY_CLASSES.length,
    classesSeen: seen.size,
  };
}
