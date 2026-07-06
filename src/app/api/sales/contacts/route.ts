import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string | null; email: string | null; company: string | null; phone: string | null; source: string | null; contact_type: string | null; country: string | null; created_on: string | null };

const SORTABLE = new Set(["name", "company", "email", "country", "created_on"]);

// crm_contacts has columns not all in the generated types — use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const GROUPS = ["founder", "investor", "advisor", "other"] as const;

function rawPhone(raw: unknown): string {
  const r = raw as Record<string, unknown> | null;
  const v = (typeof r?.phone === "string" && r.phone) || (typeof r?.mobile === "string" && r.mobile);
  return v || "";
}

// Apply the shared column filters (global search + per-column contains + country).
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

// GET /api/sales/contacts — grouped, filtered, paginated contact list.
//   ?group=founder|investor|advisor|other &offset=0&limit=50
//   filters: q, name, company, email, phone, country (csv)
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = req.nextUrl.searchParams;

  const group = p.get("group");
  const offset = Math.max(0, Number(p.get("offset") ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") ?? 50) || 50));

  const sort = p.get("sort") && SORTABLE.has(p.get("sort")!) ? p.get("sort")! : "name";
  const dir = p.get("dir") === "desc" ? false : true;

  const cols = "id, name, email, company, phone, source, contact_type, country, created_on, raw";
  let query = db().from("crm_contacts").select(cols, { count: "exact" });
  if (group && (GROUPS as readonly string[]).includes(group)) query = query.eq("contact_type", group);
  query = applyFilters(query, p);
  query = query.order(sort, { ascending: dir, nullsFirst: false }).range(offset, offset + limit - 1);

  const { data, count } = await query;
  const rows = ((data ?? []) as Array<Row & { raw?: unknown }>).map((r) => ({
    id: r.id,
    name: r.name ?? r.email ?? "Contact",
    email: r.email ?? "",
    company: r.company ?? "",
    phone: r.phone ?? rawPhone(r.raw),
    source: r.source ?? "crm",
    type: r.contact_type ?? "other",
    country: r.country ?? "",
    createdOn: r.created_on ?? "",
  }));
  return NextResponse.json({ contacts: rows, total: count ?? rows.length });
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
