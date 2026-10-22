import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ContactRow = { id: string; name: string | null; email: string | null; company: string | null; website: string | null; company_domain: string | null; country: string | null };

export type ContactGroup = {
  key: string;
  company: string;
  /** The account company this contact company is, when it is one. */
  orgId: string | null;
  orgName: string | null;
  website: string | null;
  country: string | null;
  contacts: Array<{ id: string; name: string; email: string | null }>;
};

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
 * company and group them by company, so a company with six contacts is one
 * row. Each group says whether it is a company in the account (orgId) or a
 * prospect that only exists in contacts (orgId null).
 */
export async function GET(req: Request) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Keep the search text away from the PostgREST filter syntax.
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/[,()%*_\\]/g, " ").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ groups: [] });

  const db = serviceRoleClientUntyped();
  const { data, error } = await db
    .from("crm_contacts")
    .select("id, name, email, company, website, company_domain, country")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
    .not("company", "is", null)
    .order("company")
    .limit(60);
  if (error) return NextResponse.json({ error: "Could not search contacts." }, { status: 500 });
  const rows = ((data ?? []) as ContactRow[]).filter((r) => (r.company ?? "").trim());

  const [orgs, companies] = await Promise.all([
    db.from("organizations").select("id, name").limit(2000),
    db.from("companies").select("org_id, company_name").not("org_id", "is", null).limit(2000),
  ]);
  const byName = new Map<string, { id: string; name: string }>();
  for (const o of (orgs.data ?? []) as Array<{ id: string; name: string | null }>) if (o.name?.trim()) byName.set(norm(o.name), { id: o.id, name: o.name.trim() });
  for (const c of (companies.data ?? []) as Array<{ org_id: string; company_name: string | null }>) if (c.company_name?.trim()) byName.set(norm(c.company_name), { id: c.org_id, name: c.company_name.trim() });

  const groups = new Map<string, ContactGroup>();
  for (const r of rows) {
    const company = (r.company as string).trim();
    const key = norm(company) || company.toLowerCase();
    const match = byName.get(key);
    let g = groups.get(key);
    if (!g) {
      g = { key, company, orgId: match?.id ?? null, orgName: match?.name ?? null, website: null, country: null, contacts: [] };
      groups.set(key, g);
    }
    g.website = g.website ?? ((r.website ?? r.company_domain ?? "").trim() || null);
    g.country = g.country ?? ((r.country ?? "").trim() || null);
    g.contacts.push({ id: r.id, name: (r.name ?? "").trim() || (r.email ?? "Unnamed contact"), email: r.email });
  }
  // Companies in the account first, then prospects.
  const list = [...groups.values()].sort((a, b) => Number(Boolean(b.orgId)) - Number(Boolean(a.orgId)));
  return NextResponse.json({ groups: list.slice(0, 12) });
}
