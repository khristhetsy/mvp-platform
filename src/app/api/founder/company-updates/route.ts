import { NextResponse } from "next/server";
import { isFounderInvestorCrmApiError, requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { createFounderCompanyUpdate, listFounderCompanyUpdates } from "@/lib/company-updates/company-updates";
import { companyUpdateCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireFounderInvestorCrmApi();
  if (isFounderInvestorCrmApiError(auth)) {
    return auth.error;
  }

  const result = await listFounderCompanyUpdates(auth.supabase, auth.company.id);
  if (result.error) {
    return NextResponse.json({ error: "Unable to load company updates." }, { status: 400 });
  }

  return NextResponse.json({ updates: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if (isFounderInvestorCrmApiError(auth)) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = companyUpdateCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company update payload." }, { status: 400 });
  }

  const result = await createFounderCompanyUpdate(auth.supabase, {
    companyId: auth.company.id,
    founderId: auth.profile.id,
    title: parsed.data.title,
    body: parsed.data.body,
    updateType: parsed.data.updateType,
    visibility: parsed.data.visibility,
    publish: parsed.data.publish,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Unable to save company update." }, { status: 400 });
  }

  return NextResponse.json({ update: result.data });
}
