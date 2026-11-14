/** CRM automation suggestions shown in the clock menu. Server only for the loader, the mapper is pure. */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Reminder } from "@/lib/reminders/types";

export const AUTOMATION_ID_PREFIX = "automation:";

export type AutomationReminderRow = {
  id: string; created_at: string;
  to?: { name?: string | null } | null;
  opportunity?: { id: string; title: string; owner_id: string | null } | null;
};

/** Turns a waiting suggestion into a clock row that opens the opportunity. */
export function automationToReminder(row: AutomationReminderRow): Reminder | null {
  if (!row.opportunity) return null;
  return {
    id: `${AUTOMATION_ID_PREFIX}${row.id}`,
    title: `Move ${row.opportunity.title} to ${row.to?.name ?? "the next stage"}?`,
    kind: "follow_up",
    due_at: row.created_at,
    done_at: null,
    source: "sales",
    context: "Automation",
    href: `/admin/sales/opportunities/${row.opportunity.id}`,
  };
}

/** Suggestions waiting on this person: their own opportunities, plus any with no owner. */
export async function listAutomationReminders(userId: string): Promise<Reminder[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const { data, error } = await db
    .from("sales_automation_approvals")
    .select("id, created_at, to:sales_stages!sales_automation_approvals_to_stage_id_fkey(name), opportunity:sales_opportunities(id, title, owner_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return [];
  return ((data ?? []) as AutomationReminderRow[])
    .filter((r) => !r.opportunity?.owner_id || r.opportunity.owner_id === userId)
    .map(automationToReminder)
    .filter((r): r is Reminder => r !== null);
}
