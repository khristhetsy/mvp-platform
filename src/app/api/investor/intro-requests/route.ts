import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createIntroRequest } from "@/lib/data/investor-interests";
import { openMessageThreadFromSignal } from "@/lib/messaging/open-thread-from-signal";
import { notifyFounderInvestorIntro } from "@/lib/notifications/investor-events";
import { investorIntroRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = investorIntroRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid intro request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await createIntroRequest(
    { supabase: auth.supabase, serviceSupabase: auth.serviceSupabase },
    {
      investorId: auth.profile.id,
      companyId: parsed.data.companyId,
      companySlug: parsed.data.companySlug,
      message: parsed.data.message,
    },
  );

  if ("error" in result && result.error) {
    const message = "message" in result.error ? result.error.message : "Unable to save intro request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = "data" in result ? result.data : null;
  if (!data) {
    return NextResponse.json({ error: "Unable to save intro request." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "intro_request.created",
    entityType: "intro_request",
    entityId: data.id,
    metadata: { companyId: data.company_id, status: data.status },
  });

  if (data.company_id) {
    void notifyFounderInvestorIntro({
      companyId: data.company_id,
      investorId: auth.profile.id,
      entityId: data.id,
    });
  }

  await recordInvestorCrmActivity(auth.serviceSupabase, {
    investorId: auth.profile.id,
    companyId: data.company_id,
    campaignId: data.campaign_id,
    activityType: "requested_intro",
    metadata: { entityId: data.id, message: data.message },
  });

  emitOperationalEvent(auth.serviceSupabase, {
    eventType: "investor_intro_requested",
    eventCategory: "crm",
    entityType: "intro_request",
    entityId: data.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    companyId: data.company_id,
    investorId: auth.profile.id,
    title: "Investor requested introduction",
    sourceModule: "investor_intro_requests",
    visibility: "internal",
    dedupeKey: `intro_request:${data.id}`,
    metadata: { status: data.status },
  });

  if (data.company_id) {
    void openMessageThreadFromSignal(auth.serviceSupabase, {
      companyId: data.company_id,
      investorId: auth.profile.id,
      createdBy: auth.profile.id,
      introRequestId: data.id,
      messageType: "intro_request",
      body: data.message?.trim() || "Investor requested an introduction.",
    });
  }

  return NextResponse.json({ introRequest: data });
}
