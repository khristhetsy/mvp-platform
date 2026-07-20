import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { matchingEmailsEnabled } from "./email-templates";

// In-app notifications for the match lifecycle. These respect the recipient's
// notification preferences (via createNotification). Email delivery is gated by
// MATCHING_EMAILS_LIVE and stays off until counsel approves the templates —
// see email-templates.ts.

async function investorUserId(admin: SupabaseClient, investorProfileId: string): Promise<string | null> {
  const { data } = await admin.from("investor_profiles").select("profile_id").eq("id", investorProfileId).maybeSingle();
  return (data as { profile_id: string } | null)?.profile_id ?? null;
}

async function matchContext(
  admin: SupabaseClient,
  matchId: string,
): Promise<{ companyFounderId: string | null; investorProfileId: string | null }> {
  const { data: m } = await admin
    .from("investor_founder_matches")
    .select("company_id, investor_profile_id")
    .eq("id", matchId)
    .maybeSingle();
  const row = m as { company_id: string; investor_profile_id: string } | null;
  if (!row) return { companyFounderId: null, investorProfileId: null };
  const { data: co } = await admin.from("companies").select("founder_id").eq("id", row.company_id).maybeSingle();
  return {
    companyFounderId: (co as { founder_id: string } | null)?.founder_id ?? null,
    investorProfileId: row.investor_profile_id,
  };
}

/** Notify investors of freshly-promoted (investor_notified) matches. */
export async function notifyInvestorsOfNewMatches(
  rows: Array<{ id: string; investor_profile_id: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  for (const r of rows) {
    const userId = await investorUserId(admin, r.investor_profile_id);
    if (!userId) continue;
    await createNotification({
      recipientUserId: userId,
      type: "strong_investor_match",
      title: "New founder match",
      message: "A new fit-scored match is ready to review — anonymized until you both consent to an introduction.",
      entityType: "match",
      entityId: r.id,
      deepLink: "/investor/matches",
      dedupeKey: `match_notified:${r.id}`,
    });
  }
}

/** Notify the founder that an investor expressed interest. */
export async function notifyFounderOfInterest(matchId: string): Promise<void> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { companyFounderId } = await matchContext(admin, matchId);
  if (!companyFounderId) return;
  await createNotification({
    recipientUserId: companyFounderId,
    type: "investor_interest",
    title: "An investor is interested",
    message: "A matched investor expressed interest. Review their summary and approve an introduction if you'd like to connect.",
    entityType: "match",
    entityId: matchId,
    deepLink: "/founder/matches",
    dedupeKey: `match_interest:${matchId}`,
  });
}

/** Notify the investor that the founder approved the introduction. */
export async function notifyInvestorIntroduced(matchId: string): Promise<void> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { investorProfileId } = await matchContext(admin, matchId);
  if (!investorProfileId) return;
  const userId = await investorUserId(admin, investorProfileId);
  if (!userId) return;
  await createNotification({
    recipientUserId: userId,
    type: "intro_request",
    title: "You've been introduced",
    message: "A founder approved your introduction. You can now view their profile and connect.",
    entityType: "match",
    entityId: matchId,
    deepLink: "/investor/matches",
    dedupeKey: `match_introduced:${matchId}`,
  });
}

/** Placeholder for gated email delivery — no-op until counsel approves templates. */
export function matchEmailsAreLive(): boolean {
  return matchingEmailsEnabled();
}
