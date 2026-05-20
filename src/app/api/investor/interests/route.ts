import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { createInvestorInterest } from "@/lib/data/investor-interests";
import { investorInterestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireApiProfile(["investor"]);

  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const parsed = investorInterestSchema.safeParse({
    campaignId: formData.get("campaignId"),
    interestAmount: formData.get("interestAmount") || undefined,
    message: formData.get("message")?.toString() || undefined,
    requestedCall: formData.get("requestedCall") === "true",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid investor interest request." }, { status: 400 });
  }

  const { data, error } = await createInvestorInterest(auth.supabase, {
    investor_id: auth.profile.id,
    campaign_id: parsed.data.campaignId,
    interest_amount: parsed.data.interestAmount,
    message: parsed.data.message,
    status: parsed.data.requestedCall ? "call_requested" : "new",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "investor_interest.created",
    entityType: "investor_interest",
    entityId: data.id,
    metadata: { campaignId: parsed.data.campaignId },
  });

  return NextResponse.json({
    interest: data,
  });
}
