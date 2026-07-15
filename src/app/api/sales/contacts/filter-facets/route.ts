import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/sales/contacts/filter-facets — distinct option values per questionnaire
// facet for the Contacts Filters dropdown. Universal (same options for everyone).
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();
    const { data } = await db.rpc("contact_filter_facets");
    const facets = (data ?? {}) as Record<string, string[]>;
    return NextResponse.json({
      industries: facets.industries ?? [],
      capital: facets.capital ?? [],
      fundingStages: facets.fundingStages ?? [],
      investorTypes: facets.investorTypes ?? [],
      operatingStages: facets.operatingStages ?? [],
    });
  } catch {
    return NextResponse.json({ industries: [], capital: [], fundingStages: [], investorTypes: [], operatingStages: [] });
  }
}
