/**
 * Create a Marketing list (or append to one) from contacts selected in the universal
 * Contacts grid. The grid renders crm_contacts; Marketing lists live over the
 * marketing_contacts mirror (keyed by email), so this endpoint bridges the two:
 * resolve the selection to emails, upsert the marketing_contacts mirror rows, then
 * write list memberships. Supports an explicit id selection or a "select all matching
 * the current filter" set (resolved server-side via applyContactFilters). Staff-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { applyContactFilters } from "@/lib/sales/contact-filters";

export const dynamic = "force-dynamic";

const GROUPS = ["founder", "investor", "advisor", "other"];
const MAX_TARGET = 25000;

const schema = z.object({
  mode: z.enum(["ids", "filter"]),
  ids: z.array(z.string().uuid()).max(MAX_TARGET).optional(),
  params: z.string().max(4000).optional(),
  group: z.string().max(40).optional(),
  // Destination: an existing list, or a new one (name required).
  listId: z.string().uuid().optional(),
  name: z.string().max(200).optional(),
  department: z.string().max(60).optional(),
  description: z.string().max(1000).optional(),
});

function splitName(name: string): { first: string | null; last: string | null } {
  const n = (name ?? "").trim();
  if (!n) return { first: null, last: null };
  const i = n.indexOf(" ");
  return i === -1 ? { first: n, last: null } : { first: n.slice(0, i), last: n.slice(i + 1) };
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode } = parsed.data;
  if (!parsed.data.listId && !parsed.data.name?.trim()) {
    return NextResponse.json({ error: "A list name is required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // 1. Resolve the target crm_contacts ids.
  let crmIds: string[] = [];
  if (mode === "ids") {
    crmIds = [...new Set(parsed.data.ids ?? [])];
  } else {
    const p = new URLSearchParams(parsed.data.params ?? "");
    const PAGE = 1000;
    for (let from = 0; from < MAX_TARGET; from += PAGE) {
      let q = db.from("crm_contacts").select("id").range(from, from + PAGE - 1);
      if (parsed.data.group && GROUPS.includes(parsed.data.group)) q = q.or(`contact_type.eq.${parsed.data.group},module.eq.${parsed.data.group}`);
      q = applyContactFilters(q, p);
      const { data, error } = await q;
      if (error || !data || data.length === 0) break;
      crmIds.push(...(data as Array<{ id: string }>).map((r) => r.id));
      if (data.length < PAGE) break;
    }
    crmIds = [...new Set(crmIds)];
  }
  if (crmIds.length === 0) return NextResponse.json({ error: "No contacts selected." }, { status: 400 });

  // 2. Pull email/name/company for those contacts (chunked to stay under URL limits).
  type CrmRow = { id: string; name: string | null; email: string | null; company: string | null };
  const crmRows: CrmRow[] = [];
  for (let i = 0; i < crmIds.length; i += 500) {
    const chunk = crmIds.slice(i, i + 500);
    const { data } = await db.from("crm_contacts").select("id, name, email, company").in("id", chunk);
    crmRows.push(...((data ?? []) as CrmRow[]));
  }

  // 3. Upsert the marketing_contacts mirror (dedupe by email; skip contacts with none).
  const byEmail = new Map<string, { email: string; first_name: string | null; last_name: string | null; company: string | null; source: string }>();
  let skippedNoEmail = 0;
  for (const r of crmRows) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email) { skippedNoEmail++; continue; }
    if (byEmail.has(email)) continue;
    const { first, last } = splitName(r.name ?? "");
    byEmail.set(email, { email, first_name: first, last_name: last, company: r.company ?? null, source: "crm" });
  }
  const mirrorRows = [...byEmail.values()];
  if (mirrorRows.length === 0) {
    return NextResponse.json({ error: "None of the selected contacts have an email address — they can't be added to a marketing list." }, { status: 400 });
  }

  const { data: upserted, error: upErr } = await db
    .from("marketing_contacts")
    .upsert(mirrorRows, { onConflict: "email" })
    .select("id");
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const contactIds = [...new Set((upserted ?? []).map((c: { id: string }) => c.id))];

  // 4. Resolve the destination list (existing, or create a new one).
  let listId = parsed.data.listId ?? null;
  let listName: string | null = null;
  let created = false;
  if (listId) {
    const { data: existing } = await db.from("marketing_lists").select("id, name").eq("id", listId).maybeSingle();
    if (!existing) return NextResponse.json({ error: "List not found." }, { status: 404 });
    listName = existing.name as string;
  } else {
    const insert: Record<string, unknown> = { name: parsed.data.name!.trim(), description: parsed.data.description?.trim() || null };
    if (parsed.data.department) insert.department = parsed.data.department;
    const { data: newList, error: listErr } = await db.from("marketing_lists").insert(insert).select("id, name").single();
    if (listErr || !newList) return NextResponse.json({ error: listErr?.message ?? "Could not create the list." }, { status: 500 });
    listId = newList.id as string;
    listName = newList.name as string;
    created = true;
  }

  // 5. Write memberships.
  const memberships = contactIds.map((contact_id) => ({ list_id: listId, contact_id }));
  const { error: memErr } = await db.from("marketing_list_contacts").upsert(memberships, { onConflict: "list_id,contact_id" });
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, listId, listName, created, added: contactIds.length, skippedNoEmail });
}
