import type { SupabaseClient } from "@supabase/supabase-js";
import { isActionOverdue } from "@/lib/notifications/orchestration/due-dates";
import { buildAdminDigest, buildFounderDigest, buildInvestorDigest, formatDigestForAssistant } from "@/lib/notifications/orchestration/digests";
import type { OrchestrationDigest, OrchestrationSummary } from "@/lib/notifications/orchestration/types";
import { ORCHESTRATION_SCAN_LIMIT } from "@/lib/notifications/orchestration/rules";
import type { NextBestActionRecord, NextBestActionRole } from "@/lib/next-best-actions/types";
import type { Database, Profile } from "@/lib/supabase/types";

const ACTIVE_STATUSES = ["open", "overdue", "blocked", "escalated", "snoozed"] as const;

async function fetchActiveActions(
  supabase: SupabaseClient<Database>,
  options: { userId?: string; role?: NextBestActionRole; limit?: number },
): Promise<NextBestActionRecord[]> {
  let query = supabase
    .from("next_best_actions")
    .select("*")
    .in("status", [...ACTIVE_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? ORCHESTRATION_SCAN_LIMIT);

  if (options.userId) query = query.eq("user_id", options.userId);
  if (options.role) query = query.eq("role", options.role);

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as NextBestActionRecord[];
}

export function summarizeActions(rows: NextBestActionRecord[]): OrchestrationSummary {
  const overdue = rows.filter((r) => isActionOverdue(r));
  const escalated = rows.filter((r) => r.status === "escalated");
  const blocked = rows.filter((r) => r.status === "blocked");
  const stalled = rows.filter(
    (r) =>
      r.action_type.includes("onboarding") ||
      r.action_type.includes("approval") ||
      r.category === "spv" ||
      r.action_type.includes("remediation"),
  );

  const needsAttention = rows.filter(
    (r) => isActionOverdue(r) || r.status === "escalated" || r.status === "blocked" || r.priority === "critical",
  );

  const highlights: string[] = [];
  if (overdue.length) highlights.push(`${overdue.length} overdue workflow item(s).`);
  if (blocked.length) highlights.push(`${blocked.length} blocked workflow(s).`);
  if (escalated.length) highlights.push(`${escalated.length} escalated action(s).`);
  if (stalled.length) highlights.push(`${stalled.length} potentially stalled workflow(s).`);

  return {
    overdueCount: overdue.length,
    escalatedCount: escalated.length,
    blockedCount: blocked.length,
    stalledCount: stalled.length,
    needsAttentionCount: needsAttention.length,
    highlights,
  };
}

export async function getOrchestrationSummaryForProfile(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  role: NextBestActionRole,
): Promise<OrchestrationSummary> {
  const rows = await fetchActiveActions(supabase, { userId: profile.id, role, limit: ORCHESTRATION_SCAN_LIMIT });
  return summarizeActions(rows);
}

export async function getAdminOrchestrationCounts(supabase: SupabaseClient<Database>): Promise<OrchestrationSummary> {
  const rows = await fetchActiveActions(supabase, { role: "admin", limit: ORCHESTRATION_SCAN_LIMIT });
  const analystRows = await fetchActiveActions(supabase, { role: "analyst", limit: 50 });
  return summarizeActions([...rows, ...analystRows]);
}

export async function buildOrchestrationDigestForProfile(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  role: NextBestActionRole,
): Promise<OrchestrationDigest> {
  const rows = await fetchActiveActions(supabase, { userId: profile.id, role, limit: ORCHESTRATION_SCAN_LIMIT });
  if (role === "founder") return buildFounderDigest(rows);
  if (role === "investor") return buildInvestorDigest(rows);
  return buildAdminDigest(rows);
}

export function formatOrchestrationSummaryForAssistant(summary: OrchestrationSummary, digest?: OrchestrationDigest): string {
  const parts = [...summary.highlights];
  if (digest) {
    parts.push(formatDigestForAssistant(digest));
  }
  return parts.filter(Boolean).join("\n");
}

export function isOrchestrationAttentionIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("what is overdue") ||
    lower.includes("what's overdue") ||
    lower.includes("what is blocked") ||
    lower.includes("what's blocked") ||
    lower.includes("requires attention") ||
    lower.includes("need attention") ||
    lower.includes("needs attention") ||
    lower.includes("workflows are stalled") ||
    lower.includes("workflow stalled") ||
    lower.includes("what is stalled")
  );
}
