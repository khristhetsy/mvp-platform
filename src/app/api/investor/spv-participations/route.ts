import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { upsertInvestorSpvParticipation } from "@/lib/spv/spv-workflow";
import { investorSpvParticipationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApprovedApi();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = investorSpvParticipationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid SPV participation payload." }, { status: 400 });
  }

  const result = await upsertInvestorSpvParticipation(auth.supabase, {
    investorId: auth.investorId,
    spvOpportunityId: parsed.data.spvOpportunityId,
    indicativeAmount: parsed.data.indicativeAmount,
    status: parsed.data.status,
    notes: parsed.data.notes,
  });

  if (result.error || !result.data) {
    const message = result.error instanceof Error ? result.error.message : "Unable to save participation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ participation: result.data });
}
