import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSalesScope, effectiveContactsOwner } from "@/lib/sales/scope";
import { parseContactsQuery, countContactBuckets, must } from "@/lib/sales/contacts-search";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const GROUPS = ["founder", "investor", "advisor", "other"] as const;

// Country totals scan every contact with a country (13k rows) and change only when a
// sync lands, so they are cached for 10 minutes instead of recomputed per request.
// Under database load that scan was hitting the 8s statement timeout.
const loadCountryRows = unstable_cache(
  async () =>
    must<Array<{ country: string | null; n: number }> | null>(
      db().from("crm_country_facets").select("country, n").order("n", { ascending: false }), "contacts: country facets"),
  ["crm-country-facets"],
  { revalidate: 600 },
);

// GET /api/sales/contacts/facets — role group counts for the active filters (one query,
// same predicate as the list) + the country value list.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  try {
    const q = parseContactsQuery(p);
    const scope = await getSalesScope(profile, p.get("viewAs"));
    const owner = effectiveContactsOwner(scope);

    const [buckets, countryRows] = await Promise.all([
      countContactBuckets(q.spec, owner, "profile"),
      loadCountryRows(),
    ]);
    const counts: Record<string, number> = { founder: 0, investor: 0, advisor: 0, other: 0 };
    for (const b of buckets) if (b.value in counts) counts[b.value] = b.count;
    const total = GROUPS.reduce((a, g) => a + counts[g], 0);

    const totals = new Map<string, number>();
    for (const r of countryRows ?? []) {
      if (!r.country) continue;
      totals.set(r.country, (totals.get(r.country) ?? 0) + (r.n ?? 0));
    }
    const countries = [...totals.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n).slice(0, 300);
    return NextResponse.json({ counts: { ...counts, total }, countries });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Facet count failed." }, { status: 500 });
  }
}
