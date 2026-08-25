import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/voice/contacts/search?q=… — dialer contact picker. Returns up to
// 10 Odoo CRM contacts with their external_id (the dial key), name, email, phone.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ contacts: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const { data } = await db
    .from("crm_contacts")
    .select("external_id, name, email, phone, company")
    .eq("source", "odoo")
    .or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`)
    .order("name", { ascending: true, nullsFirst: false })
    .limit(10);

  const contacts = ((data ?? []) as Array<{ external_id: string; name: string | null; email: string | null; phone: string | null; company: string | null }>)
    .map((c) => ({ externalId: c.external_id, name: c.name ?? c.email ?? c.external_id, email: c.email, phone: c.phone, company: c.company }));
  return NextResponse.json({ contacts });
}
