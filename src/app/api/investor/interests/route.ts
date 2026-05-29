import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { upsertInvestorInterest } from "@/lib/data/investor-interests";
import { investorInterestSchema } from "@/lib/validation";

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
    interestAmount: formData.get("interestAmount") || undefined,
    message: formData.get("message")?.toString() || undefined,
  };
}

export async function POST(request: Request) {
  const auth = await requireInvestorApi();

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
      interestAmount: parsed.data.interestAmount,
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

  return NextResponse.json({ interest: data });
}
