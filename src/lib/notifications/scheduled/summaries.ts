import type { SupabaseClient } from "@supabase/supabase-js";
import { actionCenterBasePath } from "@/lib/actions/filters";
import { isActionOverdue } from "@/lib/notifications/orchestration/due-dates";
import { formatScheduledDigestSummary } from "@/lib/notifications/scheduled/digest-builders";
import { getLastDigestRunAt } from "@/lib/notifications/scheduled/digest-history";
import { buildOrchestrationDigestForProfile } from "@/lib/notifications/orchestration/summaries";
import type { ActionCenterScheduledContext, ScheduledOperationalCounts } from "@/lib/notifications/scheduled/types";
import {
  buildAdminScheduledDigest,
  buildFounderScheduledDigest,
  buildInvestorScheduledDigest,
} from "@/lib/notifications/scheduled/digest-builders";
import type { NextBestActionRecord, NextBestActionRole } from "@/lib/next-best-actions/types";
import type { Database, Profile } from "@/lib/supabase/types";

const ACTIVE = ["open", "overdue", "blocked", "escalated", "snoozed"] as const;

async function fetchUserActions(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: NextBestActionRole,
  limit = 100,
): Promise<NextBestActionRecord[]> {
  const { data } = await supabase
    .from("next_best_actions")
    .select("*")
    .eq("user_id", userId)
    .eq("role", role)
    .in("status", [...ACTIVE])
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as NextBestActionRecord[];
}

export async function loadActionCenterScheduledContext(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  role: NextBestActionRole,
): Promise<ActionCenterScheduledContext> {
  const digestType = role === "founder" ? "founder_weekly_digest" : role === "investor" ? "investor_weekly_digest" : "admin_daily_digest";
  const lastDigestAt = await getLastDigestRunAt(supabase, digestType, profile.role === "admin" || profile.role === "analyst" ? null : profile.id);

  const rows = await fetchUserActions(supabase, profile.id, role);
  const digest =
    role === "founder"
      ? buildFounderScheduledDigest(rows, profile.id)
      : role === "investor"
        ? buildInvestorScheduledDigest(rows, profile.id)
        : buildAdminScheduledDigest(rows);

  const basePath = actionCenterBasePath(profile.role);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNotifs } = await supabase
    .from("notifications")
    .select("title, deep_link, created_at, orchestration_type")
    .eq("recipient_user_id", profile.id)
    .in("orchestration_type", ["reminder_generated", "workflow_attention", "digest_ready"])
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  const snoozeWindow = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const returningFromSnooze = rows
    .filter(
      (r) =>
        r.status === "open" &&
        r.snoozed_until &&
        new Date(r.snoozed_until) <= new Date() &&
        r.updated_at >= snoozeWindow,
    )
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.title,
      deepLink: r.href ?? basePath,
    }));

  const needsFollowUp = rows
    .filter((r) => isActionOverdue(r) || r.status === "escalated" || r.status === "blocked")
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      title: r.title,
      deepLink: r.href ?? basePath,
      reason: r.status === "overdue" || isActionOverdue(r) ? "Overdue" : r.status === "escalated" ? "Escalated" : "Blocked",
    }));

  return {
    digestBanner:
      digest.counts.total > 0
        ? {
            title: digest.title,
            summary: `${digest.counts.overdue} overdue · ${digest.counts.critical} critical · ${digest.counts.recommended} recommended`,
            deepLink: digest.primaryDeepLink,
            generatedAt: lastDigestAt,
          }
        : null,
    recentlyReminded: (recentNotifs ?? []).map((n) => ({
      title: n.title,
      deepLink: n.deep_link,
      createdAt: n.created_at,
    })),
    returningFromSnooze,
    needsFollowUp,
  };
}

export async function getScheduledOperationalCounts(
  supabase: SupabaseClient<Database>,
): Promise<ScheduledOperationalCounts> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: reminderCount }, { count: digestCount }, { data: overdueRows }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("orchestration_type", "reminder_generated")
      .gte("created_at", dayAgo),
    supabase
      .from("scheduled_digest_runs")
      .select("id", { count: "exact", head: true })
      .gte("generated_at", dayAgo),
    supabase
      .from("next_best_actions")
      .select("id, action_type")
      .eq("status", "overdue")
      .limit(100),
  ]);

  const actionTypes = (overdueRows ?? []).map((r) => r.action_type);
  const repeatedOverdue = actionTypes.filter((t, i) => actionTypes.indexOf(t) !== i).length;

  const { count: followUpCount } = await supabase
    .from("next_best_actions")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "overdue", "escalated", "blocked"]);

  return {
    reminderCount: reminderCount ?? 0,
    digestCount: digestCount ?? 0,
    followUpCount: followUpCount ?? 0,
    staleWorkflowCount: 0,
    repeatedOverdueCount: repeatedOverdue,
  };
}

export function isScheduledDigestIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("what reminders") ||
    lower.includes("my reminders") ||
    lower.includes("requires follow-up") ||
    lower.includes("require follow-up") ||
    lower.includes("summarize my week") ||
    lower.includes("summary of my week") ||
    lower.includes("workflows are at risk") ||
    lower.includes("workflow at risk") ||
    lower.includes("what did i miss") ||
    lower.includes("what have i missed")
  );
}

export async function formatScheduledAnswerForAssistant(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  role: NextBestActionRole,
  message: string,
): Promise<string> {
  const lower = message.toLowerCase();
  const rows = await fetchUserActions(supabase, profile.id, role);
  const digest =
    role === "founder"
      ? buildFounderScheduledDigest(rows, profile.id)
      : role === "investor"
        ? buildInvestorScheduledDigest(rows, profile.id)
        : buildAdminScheduledDigest(rows);

  if (lower.includes("reminder")) {
    const ctx = await loadActionCenterScheduledContext(supabase, profile, role);
    if (ctx.recentlyReminded.length) {
      return `Recent reminders:\n${ctx.recentlyReminded.map((r) => `• ${r.title}`).join("\n")}\n\nOpen your Action Center for full details.`;
    }
    return "No recent in-app reminders in the last 7 days. Check your Action Center for active workflow items.";
  }

  if (lower.includes("follow-up") || lower.includes("miss")) {
    const ctx = await loadActionCenterScheduledContext(supabase, profile, role);
    const lines = ctx.needsFollowUp.map((i) => `• ${i.title} (${i.reason})`);
    return lines.length
      ? `Items needing follow-up:\n${lines.join("\n")}`
      : "You have no flagged follow-up items right now.";
  }

  if (lower.includes("week") || lower.includes("summarize")) {
    return formatScheduledDigestSummary(digest);
  }

  if (lower.includes("at risk")) {
    const orch = await buildOrchestrationDigestForProfile(supabase, profile, role);
    const parts = [
      digest.counts.overdue ? `${digest.counts.overdue} overdue` : null,
      digest.counts.blocked ? `${digest.counts.blocked} blocked` : null,
      digest.counts.critical ? `${digest.counts.critical} critical` : null,
      orch.escalated.length ? `${orch.escalated.length} escalated` : null,
    ].filter(Boolean);
    return parts.length
      ? `Workflows at risk: ${parts.join(", ")}. Review your Action Center for next steps.`
      : "No high-risk workflow patterns detected in your current digest window.";
  }

  return formatScheduledDigestSummary(digest);
}
