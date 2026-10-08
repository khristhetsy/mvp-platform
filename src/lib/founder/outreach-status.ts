/**
 * Where a founder stands on the two outreach modes, in one shape.
 *
 * Automated: the company's investor_outreach_campaigns row (created and approved
 * by ensureFounderAutomatedOutreach once the CRR clears the gate) and the sends
 * recorded on investor_outreach_recipients.
 * Manual: the founder's own sequence on founder_manual_outreach_recipients; a row
 * counts as sent once last_sent_at is set.
 *
 * The Outreach step is complete only when BOTH are true: automated has been
 * launched and at least one manual email has gone out. This drives the Outreach
 * dropdown status lines, the Stage 3 guide card and checklist, and the manual
 * outreach reminders. Never throws: a status line that 500s a page is worse than
 * one that reads "Not started".
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type { AutomatedOutreachState, OutreachStatus } from "@/lib/founder/outreach-status-lines";
import { EMPTY_OUTREACH_STATUS, type AutomatedOutreachState, type OutreachStatus } from "@/lib/founder/outreach-status-lines";
export { EMPTY_OUTREACH_STATUS };

type Row = Record<string, unknown>;

export async function loadOutreachStatus(companyId: string | null | undefined): Promise<OutreachStatus> {
  if (!companyId) return EMPTY_OUTREACH_STATUS;
  try {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    const [campaignRes, manualRes] = await Promise.all([
      db.from("investor_outreach_campaigns").select("id, status, paused").eq("company_id", companyId),
      db
        .from("founder_manual_outreach_recipients")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("last_sent_at", "is", null),
    ]);

    const campaigns = (campaignRes.data ?? []) as Row[];
    const approved = campaigns.filter((c) => String(c.status) === "approved");
    const launched = approved.length > 0;
    const running = approved.some((c) => c.paused !== true);

    let automatedSent = 0;
    if (campaigns.length) {
      const { count } = await db
        .from("investor_outreach_recipients")
        .select("id", { count: "exact", head: true })
        .in("campaign_id", campaigns.map((c) => String(c.id)))
        .eq("status", "sent");
      automatedSent = count ?? 0;
    }

    const manualSent = manualRes.count ?? 0;
    const state: AutomatedOutreachState = !launched ? "not_started" : running ? "running" : "paused";
    return {
      automated: { state, sent: automatedSent, launched },
      manual: { sent: manualSent, started: manualSent > 0 },
      complete: launched && manualSent > 0,
    };
  } catch {
    return EMPTY_OUTREACH_STATUS;
  }
}
