import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { createFounderInvestorContact, listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import { founderInvestorContactSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const result = await listFounderInvestorContacts(auth.supabase, auth.profile.id, auth.company.id, {
    status: status ?? undefined,
    search: search ?? undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: "Unable to load contacts." }, { status: 400 });
  }

  return NextResponse.json({ contacts: result.data });
}

export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = founderInvestorContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact data." }, { status: 400 });
  }

  const result = await createFounderInvestorContact(auth.supabase, {
    founderId: auth.profile.id,
    companyId: auth.company.id,
    investorName: parsed.data.investor_name,
    firmName: parsed.data.firm_name,
    email: parsed.data.email || null,
    phone: parsed.data.phone,
    website: parsed.data.website || null,
    investorType: parsed.data.investor_type,
    preferredSectors: parsed.data.preferred_sectors,
    preferredStages: parsed.data.preferred_stages,
    checkSizeMin: parsed.data.check_size_min,
    checkSizeMax: parsed.data.check_size_max,
    geography: parsed.data.geography,
    source: parsed.data.source,
    tags: parsed.data.tags,
    notes: parsed.data.notes,
    status: parsed.data.status,
  });

  if (result.error) {
    const message = result.error.message?.includes("unique")
      ? "A contact with this email already exists."
      : "Unable to save contact.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ contact: result.data });
}
