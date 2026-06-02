import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";

/** Record first opportunity view for investor activation tracking (deduped). */
export async function trackInvestorOpportunityView(investorUserId: string) {
  const admin = createServiceRoleClient();
  emitOperationalEvent(admin, {
    eventType: "investor.opportunity_viewed",
    eventCategory: "investor",
    entityType: "profile",
    entityId: investorUserId,
    actorUserId: investorUserId,
    actorRole: "investor",
    title: "Opportunities viewed",
    description: "Investor opened opportunities workspace",
    sourceModule: "investor",
    severity: "info",
    dedupeKey: `investor:opportunity_view:${investorUserId}:${new Date().toISOString().slice(0, 10)}`,
    dedupeWindowMinutes: 24 * 60,
  });
}
