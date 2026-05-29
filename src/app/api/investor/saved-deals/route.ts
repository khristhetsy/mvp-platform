import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { upsertSavedDeal } from "@/lib/data/investor-interests";
import { investorSaveDealSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApi();

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = investorSaveDealSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid save deal request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await upsertSavedDeal(
    { supabase: auth.supabase, serviceSupabase: auth.serviceSupabase },
    {
      investorId: auth.profile.id,
      companyId: parsed.data.companyId,
      companySlug: parsed.data.companySlug,
    },
  );

  if ("error" in result && result.error) {
    const message = "message" in result.error ? result.error.message : "Unable to save deal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = "data" in result ? result.data : null;
  if (!data) {
    return NextResponse.json({ error: "Unable to save deal." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "saved_deal.upserted",
    entityType: "saved_deal",
    entityId: data.id,
    metadata: { companyId: data.company_id },
  });

  await recordInvestorCrmActivity(auth.serviceSupabase, {
    investorId: auth.profile.id,
    companyId: data.company_id,
    campaignId: data.campaign_id,
    activityType: "saved_deal",
    metadata: { entityId: data.id },
  });

  return NextResponse.json({ savedDeal: data });
}
