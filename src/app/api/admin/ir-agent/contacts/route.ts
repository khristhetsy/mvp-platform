import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ContactRow = { id: string; name: string | null; email: string | null; company: string | null };

/** Compare company names the way a person would: case, punctuation and legal suffixes aside. */
function norm(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|sa|plc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find a company through contacts: search CRM contacts by name, email or
 * company, and say which account company each contact's company is. A contact
 * whose company is not in the account comes back with orgId null.
 */
export async function GET(req: Request) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Keep the search text away from the PostgREST filter syntax.
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/[,()%*_\\]/g, " ").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ contacts: [] });

  const db = serviceRoleClientUntyped();
  const { data, error } = await db
    .from("crm_contacts")
    .select("id, name, email, company")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
    .not("company", "is", null)
    .order("name")
    .limit(15);
  if (error) return NextResponse.json({ error: "Could not search contacts." }, { status: 500 });
  const rows = ((data ?? []) as ContactRow[]).filter((r) => (r.company ?? "").trim());

  const [orgs, companies] = await Promise.all([
    db.from("organizations").select("id, name").limit(2000),
    db.from("companies").select("org_id, company_name").not("org_id", "is", null).limit(2000),
  ]);
  const byName = new Map<string, { id: string; name: string }>();
  for (const o of (orgs.data ?? []) as Array<{ id: string; name: string | null }>) if (o.name?.trim()) byName.set(norm(o.name), { id: o.id, name: o.name.trim() });
  for (const c of (companies.data ?? []) as Array<{ org_id: string; company_name: string | null }>) if (c.company_name?.trim()) byName.set(norm(c.company_name), { id: c.org_id, name: c.company_name.trim() });

  return NextResponse.json({
    contacts: rows.map((r) => {
      const match = byName.get(norm(r.company as string));
      return { id: r.id, name: (r.name ?? "").trim() || (r.email ?? "Unnamed contact"), email: r.email, company: (r.company as string).trim(), orgId: match?.id ?? null, orgName: match?.name ?? null };
    }),
  });
}
