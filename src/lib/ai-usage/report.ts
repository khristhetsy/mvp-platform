import "server-only";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { listSubscriptionsByProfileIds } from "@/lib/subscriptions/get-subscription";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { featureLabel } from "@/lib/ai-budget/config";
import { planBucket, type UsagePeriod } from "@/lib/ai-usage";
import { getFeatureLimits } from "@/lib/ai-usage/service";

// Read-only report behind Admin, AI usage and cost. It mirrors checkUsage in
// ./service: the same limits (admin overrides on code defaults), the same plan
// bucket, and the same rolling 7 or 30 day window, so what this page shows is what
// the limit check would decide right now. It never writes.

const DAY_MS = 86_400_000;
export const REPORT_LOOKBACK_DAYS = 60;
const ROW_CAP = 10_000;
const NEAR_SHARE = 0.8;

export type UsageStatus = "unlimited" | "within" | "near" | "at_limit" | "over";

/** at_limit: the next run is blocked. over: more runs than the cap, from before the cap was lowered. */
export function usageStatus(used: number, maxRuns: number | null): UsageStatus {
  if (maxRuns == null) return "unlimited";
  if (used > maxRuns) return "over";
  if (used === maxRuns) return "at_limit";
  if (maxRuns > 0 && used / maxRuns >= NEAR_SHARE) return "near";
  return "within";
}

export type AiUsageRow = {
  key: string;
  profileId: string;
  name: string;
  email: string;
  planType: string;
  planLabel: string;
  feature: string;
  featureLabel: string;
  /** Runs inside the limit's rolling window, as checkUsage counts them. */
  used: number;
  maxRuns: number | null;
  period: UsagePeriod;
  status: UsageStatus;
  /** ISO time the next run opens, only when blocked. */
  resetAt: string | null;
  /** Summed spend rows tied to this user and tool; null when none are tied to them. */
  costUsd: number | null;
};

export type AiUsageReport = {
  rows: AiUsageRow[];
  runs30d: number;
  usersWithRuns: number;
  toolsUsed: number;
  blockedUsers: number;
  firstUsageAt: string | null;
  spend: {
    events: number;
    totalUsd: number;
    unattributedEvents: number;
    unattributedUsd: number;
    /** Part of the unattributed cost from tools a signed in user runs, so a user should be attached. */
    userToolUsd: number;
    /** Part of the unattributed cost with no user to attach (briefings, public chat, admin tools, cron). */
    systemUsd: number;
    firstAt: string | null;
    lastAt: string | null;
  };
  truncated: boolean;
  readAt: string;
  error: string | null;
};

const SEVERITY: Record<UsageStatus, number> = { over: 0, at_limit: 1, near: 2, within: 3, unlimited: 4 };

function emptyReport(error: string | null): AiUsageReport {
  return {
    rows: [],
    runs30d: 0,
    usersWithRuns: 0,
    toolsUsed: 0,
    blockedUsers: 0,
    firstUsageAt: null,
    spend: { events: 0, totalUsd: 0, unattributedEvents: 0, unattributedUsd: 0, userToolUsd: 0, systemUsd: 0, firstAt: null, lastAt: null },
    truncated: false,
    readAt: new Date().toISOString(),
    error,
  };
}

/**
 * Spend tags that share another tool's run cap. Market claim grading is billed
 * as its own spend feature but counts against the pitch deck analyzer's limit,
 * so its cost belongs on that row.
 */
const SPEND_FEATURE_ALIAS: Record<string, string> = { market_claim_grader: "pitch_deck_analyzer" };

/** Spend tags for tools a signed in user triggers. Unattributed cost on these should carry a user. */
const USER_TOOL_FEATURES = new Set([
  "diligence_report", "business_plan", "intro_note_drafts", "support_assistant", "ai_coach", "round_health_advisor",
  "outreach_drafts", "outreach_coach", "founder_ir_agent", "ir_report", "pitch_deck_draft", "pitch_deck_analyzer",
  "market_claim_grader", "regcf_documents", "valuation_advisor", "watchlist_summary", "class_assistant",
]);

type EventRow = { profile_id: string | null; feature: string; created_at: string };
type SpendRow = { profile_id: string | null; feature: string; cost_usd: number | string | null; created_at: string };
type ProfileRow = { id: string; full_name: string | null; email: string | null };

export async function loadAiUsageReport(): Promise<AiUsageReport> {
  try {
    const db = serviceRoleClientUntyped();
    const now = Date.now();
    const since = new Date(now - REPORT_LOOKBACK_DAYS * DAY_MS).toISOString();

    const [eventsRes, spendRes] = await Promise.all([
      db
        .from("ai_usage_events")
        .select("profile_id, feature, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(ROW_CAP),
      db
        .from("ai_spend_events")
        .select("profile_id, feature, cost_usd, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(ROW_CAP),
    ]);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    if (spendRes.error) throw new Error(spendRes.error.message);

    const events = ((eventsRes.data ?? []) as EventRow[]).filter((e) => e.profile_id);
    const spend = (spendRes.data ?? []) as SpendRow[];

    const profileIds = [...new Set(events.map((e) => e.profile_id as string))];
    const features = [...new Set(events.map((e) => e.feature))];

    const [profilesRes, subs, limitsList] = await Promise.all([
      profileIds.length
        ? db.from("profiles").select("id, full_name, email").in("id", profileIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      listSubscriptionsByProfileIds(profileIds),
      Promise.all(features.map(async (f) => [f, await getFeatureLimits(f)] as const)),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    const profiles = new Map(((profilesRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    const limitsByFeature = new Map(limitsList);

    // Cost tied to a user and tool.
    const costByKey = new Map<string, number>();
    let totalUsd = 0;
    let unattributedUsd = 0;
    let unattributedEvents = 0;
    let userToolUsd = 0;
    let systemUsd = 0;
    for (const s of spend) {
      const cost = Number(s.cost_usd ?? 0);
      totalUsd += cost;
      if (!s.profile_id) {
        unattributedUsd += cost;
        unattributedEvents += 1;
        if (USER_TOOL_FEATURES.has(s.feature)) userToolUsd += cost;
        else systemUsd += cost;
        continue;
      }
      const k = `${s.profile_id}|${SPEND_FEATURE_ALIAS[s.feature] ?? s.feature}`;
      costByKey.set(k, (costByKey.get(k) ?? 0) + cost);
    }

    // Group runs by user and tool, oldest first (the query is ordered ascending).
    const groups = new Map<string, EventRow[]>();
    for (const e of events) {
      const k = `${e.profile_id}|${e.feature}`;
      const list = groups.get(k);
      if (list) list.push(e);
      else groups.set(k, [e]);
    }

    const rows: AiUsageRow[] = [];
    for (const [key, list] of groups) {
      const first = list[0];
      const profileId = first.profile_id as string;
      const feature = first.feature;
      const sub = subs.get(profileId);
      const planType = sub?.plan_type ?? "none";
      const limit = limitsByFeature.get(feature)?.[planBucket(sub?.plan_type ?? null)];
      const period: UsagePeriod = limit?.period ?? "month";
      const maxRuns = limit ? limit.maxRuns : null;
      const windowMs = (period === "month" ? 30 : 7) * DAY_MS;
      const inWindow = list.filter((e) => new Date(e.created_at).getTime() >= now - windowMs);
      const used = inWindow.length;
      const status = usageStatus(used, maxRuns);
      const blocked = status === "at_limit" || status === "over";
      const profile = profiles.get(profileId);
      rows.push({
        key,
        profileId,
        name: profile?.full_name?.trim() || profile?.email || "Unknown user",
        email: profile?.email ?? "",
        planType,
        planLabel: sub ? (PLAN_LABELS[sub.plan_type] ?? sub.plan_type) : "No plan",
        feature,
        featureLabel: featureLabel(feature),
        used,
        maxRuns,
        period,
        status,
        resetAt: blocked && inWindow[0] ? new Date(new Date(inWindow[0].created_at).getTime() + windowMs).toISOString() : null,
        costUsd: costByKey.has(key) ? (costByKey.get(key) as number) : null,
      });
    }

    rows.sort((a, b) => {
      const s = SEVERITY[a.status] - SEVERITY[b.status];
      if (s !== 0) return s;
      const ra = a.maxRuns ? a.used / a.maxRuns : 0;
      const rb = b.maxRuns ? b.used / b.maxRuns : 0;
      if (rb !== ra) return rb - ra;
      return a.name.localeCompare(b.name);
    });

    const cutoff30 = now - 30 * DAY_MS;
    return {
      rows,
      runs30d: events.filter((e) => new Date(e.created_at).getTime() >= cutoff30).length,
      usersWithRuns: profileIds.length,
      toolsUsed: features.length,
      blockedUsers: new Set(rows.filter((r) => r.status === "at_limit" || r.status === "over").map((r) => r.profileId)).size,
      firstUsageAt: events[0]?.created_at ?? null,
      spend: {
        events: spend.length,
        totalUsd,
        unattributedEvents,
        unattributedUsd,
        userToolUsd,
        systemUsd,
        firstAt: spend[0]?.created_at ?? null,
        lastAt: spend[spend.length - 1]?.created_at ?? null,
      },
      truncated: (eventsRes.data ?? []).length >= ROW_CAP || spend.length >= ROW_CAP,
      readAt: new Date(now).toISOString(),
      error: null,
    };
  } catch (e) {
    return emptyReport(e instanceof Error ? e.message : "Could not load AI usage.");
  }
}
