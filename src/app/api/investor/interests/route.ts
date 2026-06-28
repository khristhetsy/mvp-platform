import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { upsertInvestorInterest } from "@/lib/data/investor-interests";
import { notifyFounderInvestorInterest } from "@/lib/notifications/investor-events";
import { emailFounderInvestorInterest } from "@/lib/email/deal-room-emails";
import { getCompanyFounderId } from "@/lib/notifications/notifications";
import { investorInterestSchema } from "@/lib/validation";
import { track } from "@/lib/analytics/posthog";

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json().catch(() => null);
  }

  const formData = await request.formData();
  return {
    companyId: formData.get("companyId")?.toString().trim() || undefined,
    companySlug:
      formData.get("companySlug")?.toString().trim() ||
      formData.get("campaignSlug")?.toString().trim() ||
      undefined,
    message: formData.get("message")?.toString() || undefined,
  };
}

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();

  if ("error" in auth) {
    return auth.error;
  }

  const parsed = investorInterestSchema.safeParse(await parseBody(request));

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid investor interest request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await upsertInvestorInterest(
    { supabase: auth.supabase, serviceSupabase: auth.serviceSupabase },
    {
      investorId: auth.profile.id,
      companyId: parsed.data.companyId,
      companySlug: parsed.data.companySlug,
      message: parsed.data.message,
    },
  );

  if ("error" in result && result.error) {
    const message = "message" in result.error ? result.error.message : "Unable to save investor interest.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = "data" in result ? result.data : null;
  if (!data) {
    return NextResponse.json({ error: "Unable to save investor interest." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "investor_interest.upserted",
    entityType: "investor_interest",
    entityId: data.id,
    metadata: { companyId: data.company_id, status: data.status },
  });

  await recordInvestorCrmActivity(auth.serviceSupabase, {
    investorId: auth.profile.id,
    companyId: data.company_id!,
    campaignId: data.campaign_id,
    activityType: "expressed_interest",
    metadata: {
      entityId: data.id,
      message: data.message,
    },
  });

  emitOperationalEvent(auth.serviceSupabase, {
    eventType: "investor_interest_expressed",
    eventCategory: "crm",
    entityType: "investor_interest",
    entityId: data.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    companyId: data.company_id,
    investorId: auth.profile.id,
    title: "Investor expressed interest",
    sourceModule: "investor_interests",
    visibility: "internal",
    dedupeKey: `investor_interest:${data.id}`,
    metadata: { status: data.status },
  });

  if (data.company_id) {
    void notifyFounderInvestorInterest({
      companyId: data.company_id,
      investorId: auth.profile.id,
      entityId: data.id,
    });

    // Fire-and-forget email alert to the founder
    void (async () => {
      const company = await getCompanyFounderId(data.company_id!);
      if (company?.founder_id) {
        await emailFounderInvestorInterest({
          founderId: company.founder_id,
          investorId: auth.profile.id,
          companyName: company.company_name ?? "your company",
        });
      }
    })();
  }

  track("investor_interest_expressed", { userId: auth.profile.id, companyId: data.company_id, status: data.status });

  return NextResponse.json({ interest: data });
}
