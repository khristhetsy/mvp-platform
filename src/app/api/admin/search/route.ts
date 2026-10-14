import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type AdminSearchResult = {
  id: string;
  type: "contact" | "company" | "event";
  title: string;
  subtitle: string | null;
  href: string;
};

// GET /api/admin/search?q=… : global ⌘K record search for the admin workspace.
// Contacts (crm_contacts), companies and events. Few rows per type, one cheap
// query each, no counts (the database is slow per buffer access).
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const safe = q.replace(/[%_,()]/g, "");
  if (safe.length < 2) return NextResponse.json({ results: [] });
  const starts = `${safe}%`;
  const wordStart = `% ${safe}%`;
  const contains = `%${safe}%`;

  const [contactsRes, companiesRes, eventsRes] = await Promise.all([
    // Prefix and word start matches only, so a common name stops after 5 rows
    // instead of scanning the whole table.
    db
      .from("crm_contacts")
      .select("id, name, email, company")
      .or(`name.ilike.${starts},name.ilike.${wordStart},email.ilike.${starts}`)
      .limit(5),
    db
      .from("companies")
      .select("id, company_name, status")
      .ilike("company_name", contains)
      .limit(4),
    db
      .from("events")
      .select("id, title, status, starts_at")
      .ilike("title", contains)
      .limit(3),
  ]);

  const results: AdminSearchResult[] = [];

  for (const c of (contactsRes.data ?? []) as Array<{ id: string; name: string | null; email: string | null; company: string | null }>) {
    results.push({
      id: c.id,
      type: "contact",
      title: c.name ?? c.email ?? "Contact",
      subtitle: [c.company, c.email].filter(Boolean).join(" · ") || null,
      href: `/admin/sales/contacts/${c.id}`,
    });
  }

  for (const c of (companiesRes.data ?? []) as Array<{ id: string; company_name: string | null; status: string | null }>) {
    results.push({
      id: c.id,
      type: "company",
      title: c.company_name ?? "Company",
      subtitle: c.status ?? null,
      href: `/admin/companies/${c.id}`,
    });
  }

  for (const e of (eventsRes.data ?? []) as Array<{ id: string; title: string | null; status: string | null; starts_at: string | null }>) {
    results.push({
      id: e.id,
      type: "event",
      title: e.title ?? "Event",
      subtitle: [e.status, e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 10) : null].filter(Boolean).join(" · ") || null,
      href: `/admin/events/${e.id}`,
    });
  }

  return NextResponse.json({ results });
}
