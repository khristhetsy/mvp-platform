import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string | null; email: string | null; company: string | null; phone: string | null; source: string | null };

// crm_contacts has columns not all in the generated types — use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

// GET /api/sales/contacts?q= — search the CRM contact mirror (Odoo-synced + manual + other).
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q")?.trim();

  let query = db().from("crm_contacts").select("id, name, email, company, phone, source").order("name", { ascending: true }).limit(100);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data } = await query;
  const rows = ((data ?? []) as Row[]).map((r) => ({
    id: r.id, name: r.name ?? r.email ?? "Contact", email: r.email ?? "", company: r.company ?? "", phone: r.phone ?? "", source: r.source ?? "crm",
  }));
  return NextResponse.json({ contacts: rows });
}

const addSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
});

// POST /api/sales/contacts — add a new contact (stored in the CRM mirror as source='manual').
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A contact name is required." }, { status: 400 });
  const { data, error } = await db()
    .from("crm_contacts")
    .insert({ name: parsed.data.name.trim(), email: parsed.data.email || null, company: parsed.data.company || null, phone: parsed.data.phone || null, source: "manual" })
    .select("id, name, email, company, phone, source")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
