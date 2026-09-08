import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSalesScope, effectiveContactsOwner } from "@/lib/sales/scope";
import { applyContactFilters } from "@/lib/sales/contact-filters";
import { AGG_SELECT, GROUP_DIMS, bucketRows, bucketLabel, isGroupBy, type LiteRow } from "@/lib/sales/contact-grouping";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

// Rows scanned to compute group counts. Sales contacts are in the low tens of
// thousands; one lightweight select over the filtered set is cheaper than a
// count query per bucket, and lets every dimension be grouped in memory.
const SCAN_CAP = 25000;

// GET /api/sales/contacts/groups?by=<dimension> — group values + counts for the
// chosen dimension, respecting the active filters. Mirrors the list's filters so
// the group counts match what expanding a group will show.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = req.nextUrl.searchParams;

  const by = p.get("by");
  if (!isGroupBy(by)) return NextResponse.json({ error: "Unknown group-by dimension." }, { status: 400 });

  const scope = await getSalesScope(profile, p.get("viewAs"));
  const contactsOwner = effectiveContactsOwner(scope);

  let query = db().from("crm_contacts").select(AGG_SELECT);
  if (contactsOwner) query = query.contains("assignee_ids", [contactsOwner]);
  // Optional role narrowing (Any/Founder/Investor/Advisor) — matches the list's
  // ?group= so grouping by another dimension can still be scoped to one role.
  const role = p.get("group");
  if (role && ["founder", "investor", "advisor", "other"].includes(role)) query = query.or(`contact_type.eq.${role},module.eq.${role}`);
  query = applyContactFilters(query, p).range(0, SCAN_CAP - 1);

  const { data } = await query;
  const rows = (data ?? []) as LiteRow[];

  const buckets = bucketRows(rows, by);

  // The capped in-memory scan is fine for discovering bucket VALUES but under-counts on
  // a large table (e.g. "Investment Bank" showed 2 when 58 exist). Recompute each visible
  // bucket's count with a real DB count query using the exact filter the row expansion
  // uses, so the header count always equals the rows shown. Bounded to the top buckets.
  const ROLES = ["founder", "investor", "advisor", "other"];
  const TOP = 80;
  const counted = await Promise.all(buckets.slice(0, TOP).map(async (b) => {
    let q = db().from("crm_contacts").select("id", { count: "exact", head: true });
    if (contactsOwner) q = q.contains("assignee_ids", [contactsOwner]);
    if (role && ROLES.includes(role)) q = q.or(`contact_type.eq.${role},module.eq.${role}`);
    q = GROUP_DIMS[by].applyFilter(q, b.value);
    q = applyContactFilters(q, p);
    const { count, error } = await q;
    return { value: b.value, count: error ? b.count : (count ?? b.count) };
  }));
  const accurate = [...counted, ...buckets.slice(TOP)]
    .sort((a, b) => (a.value === "__none__" ? 1 : b.value === "__none__" ? -1 : b.count - a.count));

  // Resolve assignee names for the "Salesperson / owner" dimension.
  const nameById = new Map<string, string>();
  if (GROUP_DIMS[by].needsNames) {
    const ids = accurate.map((b) => b.value).filter((v) => v && v !== "__none__");
    if (ids.length) {
      const { data: profs } = await db().from("profiles").select("id, full_name, email").in("id", ids);
      for (const pr of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        nameById.set(pr.id, pr.full_name ?? pr.email ?? "Member");
      }
    }
  }

  const groups = accurate.map((b) => ({ id: b.value, label: bucketLabel(by, b.value, nameById), count: b.count }));
  const total = accurate.reduce((a, b) => a + b.count, 0);
  const capped = rows.length >= SCAN_CAP;
  return NextResponse.json({ groups, total, capped });
}
