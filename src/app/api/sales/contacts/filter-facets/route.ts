import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getContactFilterFacets, FACET_KEYS, type ContactFacets } from "@/lib/sales/contact-facets";

export const dynamic = "force-dynamic";

const EMPTY = { industries: [], capital: [], fundingStages: [], investorTypes: [], operatingStages: [] };
const TTL_MS = 24 * 60 * 60 * 1000; // self-refresh the cached options once a day

function hasValues(f: ContactFacets | null | undefined): boolean {
  return !!f && FACET_KEYS.some((k) => (f[k]?.length ?? 0) > 0);
}

// GET /api/sales/contacts/filter-facets — distinct option values per questionnaire
// facet for the Contacts Filters dropdown. Served from a precomputed cache row
// (instant); recomputed and re-cached when missing or older than a day.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();

    // Fast path: read the single cache row.
    const { data: row } = await db.from("crm_facet_cache").select("data, updated_at").eq("id", "default").maybeSingle();
    const cached = (row?.data ?? null) as ContactFacets | null;
    const fresh = row?.updated_at ? Date.now() - new Date(row.updated_at).getTime() < TTL_MS : false;
    if (fresh && hasValues(cached)) return NextResponse.json(cached);

    // Stale or missing → recompute and re-cache.
    const facets = await getContactFilterFacets(db, true);
    if (hasValues(facets)) {
      await db.from("crm_facet_cache").upsert({ id: "default", data: facets, updated_at: new Date().toISOString() }, { onConflict: "id" });
      return NextResponse.json(facets);
    }
    // Nothing computed but we have a stale cache — serve it rather than empty.
    return NextResponse.json(hasValues(cached) ? cached : EMPTY);
  } catch {
    return NextResponse.json(EMPTY);
  }
}
