import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSalesScope, effectiveContactsOwner } from "@/lib/sales/scope";
import { GROUP_DIMS, bucketLabel, isGroupBy } from "@/lib/sales/contact-grouping";
import { parseContactsQuery, countContactBuckets, must } from "@/lib/sales/contacts-search";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

// GET /api/sales/contacts/groups?by=<dimension> — bucket values + counts for the chosen
// dimension over the active filters. One SQL query (count_contact_buckets) with the same
// predicate the list uses, so a header count always equals the rows the group expands to.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = req.nextUrl.searchParams;

  const by = p.get("by");
  if (!isGroupBy(by)) return NextResponse.json({ error: "Unknown group-by dimension." }, { status: 400 });
  try {
    const q = parseContactsQuery(p);
    const scope = await getSalesScope(profile, p.get("viewAs"));
    const buckets = await countContactBuckets(q.spec, effectiveContactsOwner(scope), by);

    // Resolve assignee names for the "Salesperson / owner" dimension.
    const nameById = new Map<string, string>();
    if (GROUP_DIMS[by].needsNames) {
      const ids = buckets.map((b) => b.value).filter((v) => v && v !== "__none__");
      if (ids.length) {
        const profs = await must<Array<{ id: string; full_name: string | null; email: string | null }> | null>(
          db().from("profiles").select("id, full_name, email").in("id", ids), "contacts groups: assignee names");
        for (const pr of profs ?? []) nameById.set(pr.id, pr.full_name ?? pr.email ?? "Member");
      }
    }
    const groups = buckets.map((b) => ({ id: b.value, label: bucketLabel(by, b.value, nameById), count: b.count }));
    const total = groups.reduce((a, b) => a + b.count, 0);
    return NextResponse.json({ groups, total, capped: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Group counts failed." }, { status: 500 });
  }
}
