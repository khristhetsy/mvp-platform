import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createFounderInvestorContact } from "@/lib/founder-crm/contacts";

export const dynamic = "force-dynamic";

// POST /api/founder/matching/follow-up — add a (connected) matched investor to the
// founder's own Investor CRM as a lead to work manually. Gated on the client to
// connected investors; the lead is tagged so it's clear it came from Matching.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | { name?: string; firm?: string | null; investorType?: string | null }
    | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 400 });

  try {
    await createFounderInvestorContact(auth.supabase, {
      founderId: auth.profile.id,
      companyId: company.id,
      investorName: name,
      firmName: body?.firm ?? null,
      investorType: body?.investorType ?? null,
      source: "matching",
      status: "selected",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't add to follow-up." }, { status: 500 });
  }
}
