import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { submitInvestorPledge } from "@/lib/data/investor-pledges";
import { notifyFounderInvestorPledge } from "@/lib/notifications/investor-events";
import { investorPledgeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();

  if ("error" in auth) {
    return auth.error;
  }

  // Admin switch (Feature Controls, Pledged amounts): off refuses new indicated amounts.
  const flags = await loadFeatureFlags(auth.serviceSupabase);
  if (!isFeatureEnabled(flags, "investor", "pledged")) {
    return NextResponse.json({ error: "Indicated amounts are not available right now." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = investorPledgeSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid interest request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await submitInvestorPledge(
    { supabase: auth.supabase, serviceSupabase: auth.serviceSupabase },
    {
      investorId: auth.profile.id,
      companyId: parsed.data.companyId,
      companySlug: parsed.data.companySlug,
      pledgeAmount: parsed.data.pledgeAmount,
      pledgeCurrency: parsed.data.pledgeCurrency,
    },
  );

  if ("error" in result && result.error) {
    const message = "message" in result.error ? result.error.message : "Unable to submit indicated amount.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = "data" in result ? result.data : null;
  if (!data) {
    return NextResponse.json({ error: "Unable to submit indicated amount." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "investor_pledge.submitted",
    entityType: "investor_interest",
    entityId: data.id,
    metadata: {
      companyId: data.company_id,
      pledgeAmount: data.pledge_amount,
      pledgeCurrency: data.pledge_currency,
    },
  });

  await recordInvestorCrmActivity(auth.serviceSupabase, {
    investorId: auth.profile.id,
    companyId: data.company_id!,
    campaignId: data.campaign_id,
    activityType: "pledge_amount_submitted",
    metadata: {
      entityId: data.id,
      pledgeAmount: data.pledge_amount,
      pledgeCurrency: data.pledge_currency,
    },
  });

  if (data.company_id && data.pledge_amount != null) {
    void notifyFounderInvestorPledge({
      companyId: data.company_id,
      investorId: auth.profile.id,
      entityId: data.id,
      pledgeAmount: Number(data.pledge_amount),
      pledgeCurrency: data.pledge_currency ?? "USD",
    });
  }

  return NextResponse.json({ pledge: data });
}
