import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { submitInvestorPledge } from "@/lib/data/investor-pledges";
import { investorPledgeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = investorPledgeSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid pledge request.";
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
    const message = "message" in result.error ? result.error.message : "Unable to submit pledge amount.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = "data" in result ? result.data : null;
  if (!data) {
    return NextResponse.json({ error: "Unable to submit pledge amount." }, { status: 400 });
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

  return NextResponse.json({ pledge: data });
}
