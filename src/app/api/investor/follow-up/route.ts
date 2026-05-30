import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { createIcfoFollowUpRequest } from "@/lib/data/investor-interests";
import { openMessageThreadFromSignal } from "@/lib/messaging/open-thread-from-signal";
import { notifyFounderInvestorFollowUp } from "@/lib/notifications/investor-events";
import { investorIntroRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = investorIntroRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid follow-up request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await createIcfoFollowUpRequest(
    { supabase: auth.supabase, serviceSupabase: auth.serviceSupabase },
    {
      investorId: auth.profile.id,
      companyId: parsed.data.companyId,
      companySlug: parsed.data.companySlug,
      message: parsed.data.message ?? "Investor requested CapitalOS platform follow-up.",
    },
  );

  if ("error" in result && result.error) {
    const message = "message" in result.error ? result.error.message : "Unable to submit follow-up request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = "data" in result ? result.data : null;
  if (!data) {
    return NextResponse.json({ error: "Unable to submit follow-up request." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "icfo_follow_up.requested",
    entityType: "intro_request",
    entityId: data.id,
    metadata: { companyId: data.company_id },
  });

  if (data.company_id) {
    void notifyFounderInvestorFollowUp({
      companyId: data.company_id,
      investorId: auth.profile.id,
      entityId: data.id,
    });
  }

  await recordInvestorCrmActivity(auth.serviceSupabase, {
    investorId: auth.profile.id,
    companyId: data.company_id,
    campaignId: data.campaign_id,
    activityType: "follow_up_requested",
    metadata: { entityId: data.id, message: data.message },
  });

  if (data.company_id) {
    void openMessageThreadFromSignal(auth.serviceSupabase, {
      companyId: data.company_id,
      investorId: auth.profile.id,
      createdBy: auth.profile.id,
      introRequestId: data.id,
      messageType: "follow_up",
      body: data.message?.trim() || "Investor requested CapitalOS platform follow-up.",
    });
  }

  return NextResponse.json({ followUp: data });
}
