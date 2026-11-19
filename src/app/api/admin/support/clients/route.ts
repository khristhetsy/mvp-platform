import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { cleanSearch, shapeClients, type PickerProfile } from "@/lib/support/client-picker";

export const dynamic = "force-dynamic";

const PER_ROLE = 40;

/**
 * GET /api/admin/support/clients?q=: the pick list behind New message to client.
 * Newest accounts first. A search matches name, email and, for founders, company
 * name. Returns up to 40 founders and 40 investors plus the full match counts, so
 * the list can say how many it is not showing.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const q = cleanSearch(req.nextUrl.searchParams.get("q") ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

  // Founders are also found by their company name.
  let companyFounderIds: string[] = [];
  if (q) {
    const { data } = await db.from("companies").select("founder_id").ilike("company_name", `%${q}%`).limit(100);
    companyFounderIds = [...new Set(((data ?? []) as Array<{ founder_id: string | null }>).map((c) => c.founder_id).filter((v): v is string => Boolean(v)))];
  }

  async function load(role: "founder" | "investor") {
    let query = db
      .from("profiles")
      .select("id, full_name, email, role", { count: "exact" })
      .eq("role", role)
      .eq("is_active", true);
    if (q) {
      const like = `%${q}%`;
      const parts = [`full_name.ilike.${like}`, `email.ilike.${like}`];
      if (role === "founder" && companyFounderIds.length) parts.push(`id.in.(${companyFounderIds.join(",")})`);
      query = query.or(parts.join(","));
    }
    const { data, count } = await query.order("created_at", { ascending: false }).limit(PER_ROLE);
    return { rows: (data ?? []) as PickerProfile[], total: count ?? 0 };
  }

  const [founders, investors] = await Promise.all([load("founder"), load("investor")]);
  const founderIds = founders.rows.map((p) => p.id);

  const [{ data: companies }, { data: subs }] = await Promise.all([
    founderIds.length
      ? db.from("companies").select("founder_id, company_name, created_at").in("founder_id", founderIds).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    founderIds.length ? db.from("subscriptions").select("profile_id, plan_type").in("profile_id", founderIds) : Promise.resolve({ data: [] }),
  ]);

  // A founder's first company is the one support threads attach to.
  const companyByFounder = new Map<string, string>();
  for (const c of (companies ?? []) as Array<{ founder_id: string; company_name: string | null }>) {
    if (!companyByFounder.has(c.founder_id) && c.company_name) companyByFounder.set(c.founder_id, c.company_name);
  }
  const planByProfile = new Map<string, string>(
    ((subs ?? []) as Array<{ profile_id: string; plan_type: string }>).map((s) => [s.profile_id, s.plan_type]),
  );

  return NextResponse.json({
    clients: shapeClients([...founders.rows, ...investors.rows], companyByFounder, planByProfile),
    totals: { founder: founders.total, investor: investors.total },
  });
}
