import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { loadInvestorReach } from "@/lib/admin/investor-reach";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Investor reach: introductions, automated and manual outreach, with delivery
 * and opens. Staff only.
 * GET ?company=<company id>   one founder company
 * GET ?contact=<contact id>   one investor (Investor Contact record)
 */
export async function GET(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const p = new URL(request.url).searchParams;
  const company = p.get("company");
  const contact = p.get("contact");
  try {
    if (company && UUID.test(company)) return NextResponse.json(await loadInvestorReach({ companyId: company }));
    if (contact && UUID.test(contact)) return NextResponse.json(await loadInvestorReach({ contactId: contact }));
    return NextResponse.json({ error: "Pass company or contact." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load investor reach." }, { status: 500 });
  }
}
