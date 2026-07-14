import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSalesScope } from "@/lib/sales/scope";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }
const GROUPS = ["founder", "investor", "advisor", "other"] as const;

const bodySchema = z.object({
  assigneeId: z.string().uuid().nullable(),   // null = unassign
  group: z.string().optional(),
  onlyUnassigned: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, p: URLSearchParams): any {
  const q = p.get("q")?.trim();
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`);
  for (const col of ["name", "company", "email", "phone"]) {
    const v = p.get(col)?.trim();
    if (v) query = query.ilike(col, `%${v}%`);
  }
  const countries = p.get("country")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (countries && countries.length) query = query.in("country", countries);
  return query;
}

// POST /api/sales/contacts/assign?<same filters as the list> — bulk-set owner_id for
// the matching contacts. Admins only.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const scope = await getSalesScope(profile);
  if (!scope.isManager) return NextResponse.json({ error: "Only admins can assign contacts to reps." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid assignee (or null to unassign) is required." }, { status: 400 });

  const p = req.nextUrl.searchParams;
  let q = db().from("crm_contacts").update({ owner_id: parsed.data.assigneeId }, { count: "exact" });
  if (parsed.data.group && (GROUPS as readonly string[]).includes(parsed.data.group)) q = q.eq("contact_type", parsed.data.group);
  if (parsed.data.onlyUnassigned) q = q.is("owner_id", null);
  q = applyFilters(q, p);

  const { count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assigned: count ?? 0 });
}
