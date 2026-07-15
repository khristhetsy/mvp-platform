import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSalesScope } from "@/lib/sales/scope";
import { applyContactFilters } from "@/lib/sales/contact-filters";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const GROUPS = ["founder", "investor", "advisor", "other"] as const;

// GET /api/sales/contacts/facets — group counts (respecting active filters) + country value list.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const scope = await getSalesScope(profile);

  const countOne = async (group: string): Promise<number> => {
    let q = db().from("crm_contacts").select("id", { count: "exact", head: true }).eq("contact_type", group);
    if (!scope.canSeeAllContacts) q = q.contains("assignee_ids", [scope.ownerId]);
    q = applyContactFilters(q, p);
    const { count } = await q;
    return count ?? 0;
  };

  // Country facet list (top values by frequency), from the pre-aggregated view.
  const countriesPromise = (async () => {
    const { data } = await db().from("crm_country_facets").select("country, n").order("n", { ascending: false });
    const totals = new Map<string, number>();
    for (const r of (data ?? []) as { country: string | null; n: number }[]) {
      if (!r.country) continue;
      totals.set(r.country, (totals.get(r.country) ?? 0) + (r.n ?? 0));
    }
    return [...totals.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n).slice(0, 300);
  })();

  const [founder, investor, advisor, other, countries] = await Promise.all([
    countOne("founder"), countOne("investor"), countOne("advisor"), countOne("other"), countriesPromise,
  ]);

  const counts: Record<string, number> = { founder, investor, advisor, other };
  const total = GROUPS.reduce((a, g) => a + counts[g], 0);
  return NextResponse.json({ counts: { ...counts, total }, countries });
}
