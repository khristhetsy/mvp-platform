import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getContactFilterFacets } from "@/lib/sales/contact-facets";

export const dynamic = "force-dynamic";

// GET /api/sales/contacts/filter-facets — distinct option values per questionnaire
// facet for the Contacts Filters dropdown. Universal (same options for everyone).
// Computed directly from crm_contacts.raw->__profile (no PostgREST .rpc() dependency).
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const facets = await getContactFilterFacets(serviceRoleClientUntyped());
    return NextResponse.json(facets);
  } catch {
    return NextResponse.json({ industries: [], capital: [], fundingStages: [], investorTypes: [], operatingStages: [] });
  }
}
