import { NextResponse } from "next/server";
import { requireInvestorApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { createIntroRequest } from "@/lib/data/investor-interests";
import { investorIntroRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireInvestorApi();

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

  return NextResponse.json({ introRequest: data });
}
