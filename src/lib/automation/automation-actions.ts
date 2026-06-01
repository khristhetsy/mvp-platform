import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import type { AutomationPlannedAction } from "@/lib/automation/types";
import { upsertComputedActions, updateActionStatus } from "@/lib/next-best-actions/lifecycle";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type { NextBestAction } from "@/lib/next-best-actions/types";
import type { Database, Profile } from "@/lib/supabase/types";

async function loadProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

function fullNba(partial: Partial<NextBestAction>, role: NextBestAction["role"]): NextBestAction {
  return {
    id: partial.id ?? `auto_${Date.now()}`,
    role: partial.role ?? role,
    title: partial.title ?? "Workflow follow-up",
    description: partial.description ?? "",
    priority: partial.priority ?? "medium",
    category: partial.category ?? "system",
    entityType: partial.entityType ?? "system",
    entityId: partial.entityId,
    companyId: partial.companyId,
    investorId: partial.investorId,
    spvId: partial.spvId,
    href: partial.href ?? "/admin/actions",
    sourceModule: partial.sourceModule ?? "workflow_automation",
    reason: partial.reason ?? "",
    blockers: partial.blockers ?? [],
    createdFrom: partial.createdFrom ?? "workflow_automation",
    metadata: partial.metadata ?? {},
  };
}

export async function executePlannedAction(
  supabase: SupabaseClient<Database>,
  action: AutomationPlannedAction,
  dryRun: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (dryRun) {
    return { ok: true, message: `[dry-run] ${action.title}` };
  }

  const admin = createServiceRoleClient();

  try {
    if (action.actionType === "create_nba" && action.nba && action.targetUserId) {
      const profile = await loadProfile(admin, action.targetUserId);
      if (!profile) return { ok: false, message: "Target profile not found." };
      const nba = fullNba(action.nba, profile.role === "analyst" ? "analyst" : (action.nba.role ?? profile.role) as NextBestAction["role"]);
      await upsertComputedActions(admin, profile, [nba]);
      return { ok: true, message: `Created action: ${nba.title}` };
    }

    if (action.actionType === "update_nba_status" && action.targetUserId && action.metadata) {
      const profile = await loadProfile(admin, action.targetUserId);
      if (!profile) return { ok: false, message: "Target profile not found." };
      const { data: rows } = await admin
        .from("next_best_actions")
        .select("id")
        .eq("user_id", action.targetUserId)
        .ilike("action_type", `%${String(action.metadata.actionTypeKey ?? "")}%`)
        .in("status", ["open", "overdue"])
        .limit(1);
      const row = rows?.[0];
      if (row && action.metadata.desiredStatus === "completed") {
        await updateActionStatus(admin, profile, row.id, { action: "complete" });
        return { ok: true, message: "Updated action status to completed." };
      }
      return { ok: true, message: "No matching open action to update." };
    }

    if (action.actionType === "create_notification" && action.notification && action.targetUserId) {
      await createNotification({
        recipientUserId: action.targetUserId,
        type: action.notification.type,
        title: action.notification.title,
        message: action.notification.message,
        orchestrationType: "workflow_attention",
      });
      return { ok: true, message: "Notification created." };
    }

    if (
      (action.actionType === "escalation_visibility" || action.actionType === "create_reminder") &&
      action.notification &&
      action.targetUserId
    ) {
      await createNotification({
        recipientUserId: action.targetUserId,
        type: action.notification.type,
        title: action.notification.title,
        message: action.notification.message,
        orchestrationType: "reminder_generated",
      });
      return { ok: true, message: "Escalation visibility notification created." };
    }

    if (action.actionType === "operational_event" && action.operationalEvent) {
      emitOperationalEvent(admin, {
        eventType: action.operationalEvent.eventType,
        eventCategory: "system",
        entityType: action.metadata?.entityType as string ?? "workflow",
        entityId: (action.metadata?.entityId as string) ?? null,
        companyId: action.metadata?.companyId as string ?? null,
        spvId: action.metadata?.spvId as string ?? null,
        title: action.operationalEvent.title,
        description: null,
        metadata: sanitizeOperationalMetadata({
          automation_rule: action.ruleId,
          dedupe_key: action.dedupeKey,
        }),
        sourceModule: "workflow_automation",
        visibility: "admin_only",
        dedupeKey: action.dedupeKey,
        dedupeWindowMinutes: 60,
      });
      return { ok: true, message: "Operational event emitted." };
    }

    if (action.actionType === "readiness_recompute") {
      emitOperationalEvent(admin, {
        eventType: "workflow_automation_completed",
        eventCategory: "system",
        entityType: "company",
        entityId: (action.metadata?.companyId as string) ?? null,
        companyId: (action.metadata?.companyId as string) ?? null,
        spvId: (action.metadata?.spvId as string) ?? null,
        title: action.title,
        description: null,
        metadata: sanitizeOperationalMetadata({ rule: action.ruleId }),
        sourceModule: "workflow_automation",
        visibility: "admin_only",
        dedupeKey: action.dedupeKey,
      });
      return { ok: true, message: "Readiness recompute signal recorded." };
    }

    if (action.actionType === "follow_up_task" && action.nba && action.targetUserId) {
      const profile = await loadProfile(admin, action.targetUserId);
      if (!profile) return { ok: false, message: "Target profile not found." };
      const nba = fullNba(action.nba, action.nba.role ?? "founder");
      await upsertComputedActions(admin, profile, [nba]);
      return { ok: true, message: `Follow-up task: ${nba.title}` };
    }

    if (action.actionType === "workflow_summary") {
      return { ok: true, message: "Workflow summary recorded in run metadata." };
    }

    return { ok: true, message: "No-op action type." };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Action failed.";
    return { ok: false, message };
  }
}
