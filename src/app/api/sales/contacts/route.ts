import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSalesScope, effectiveContactsOwner } from "@/lib/sales/scope";
import { loadLastMessages } from "@/lib/sales/contact-last-message";
import { loadNextActivities } from "@/lib/sales/contact-next-activity";
import { parseContactsQuery, searchContacts, must } from "@/lib/sales/contacts-search";

export const dynamic = "force-dynamic";

// crm_contacts has columns not all in the generated types — use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** Odoo exports an empty field as the boolean `false`; read through `raw->>'…'` that
 *  arrives as the string "false". Treat it (and "False") as blank, not as a value. */
function odooText(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s === "" || s.toLowerCase() === "false" ? "" : s;
}

// GET /api/sales/contacts — one page of the filtered list + exact total.
//   filter=<FilterSpec JSON> · groupBy/groupValue (or group=<role>) · sort/dir · offset/limit
// The predicate is built by the search_contacts SQL function; see contacts-search.ts.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  try {
    const q = parseContactsQuery(p);
    const scope = await getSalesScope(profile, p.get("viewAs"));
    // Scoped users (and a super admin "viewing as" a rep) see a contact only if that
    // owner is one of its Lead-assigned members. Admins / "see all" depts see everything.
    // A grouped page skips the count: the group header already has it (same predicate).
    const { rows: raw, total } = await searchContacts(q, effectiveContactsOwner(scope), !q.groupBy);

    // Resolve assignee names for the Lead assign column in one lookup.
    const ids = [...new Set(raw.flatMap((r) => (Array.isArray(r.assignee_ids) ? r.assignee_ids : [])))];
    const nameById = new Map<string, string>();
    if (ids.length) {
      const profs = await must<Array<{ id: string; full_name: string | null; email: string | null }> | null>(
        db().from("profiles").select("id, full_name, email").in("id", ids), "contacts: assignee names");
      for (const pr of profs ?? []) nameById.set(pr.id, pr.full_name ?? pr.email ?? "Member");
    }

    // Latest "message communicated" per contact (notes + sends + replies), bulk.
    const [lastMsg, nextAct] = await Promise.all([
      loadLastMessages(db(), raw.map((r) => ({ id: r.id, email: r.email ?? null, source: r.source ?? null, external_id: r.external_id ?? null }))),
      // "Activities" column: next open task per contact (one query for the page).
      loadNextActivities(db(), raw.map((r) => r.id)),
    ]);

    const rows = raw.map((r) => ({
      id: r.id,
      name: r.name ?? r.email ?? "Contact",
      email: r.email ?? "",
      company: r.company ?? "",
      phone: r.phone || odooText(r.raw_phone) || odooText(r.raw_mobile) || "",
      source: r.source ?? "crm",
      type: r.contact_type ?? "other",
      country: r.country ?? "",
      // Fall back to the promote/insert date (synced_at) when there's no Odoo
      // create_date — e.g. SEC Form D promotions, which have no raw.create_date.
      createdOn: r.created_on ?? (r.synced_at ? String(r.synced_at).slice(0, 10) : ""),
      // Lead source: the override (Form D + edits) or the Odoo profile value.
      leadSource: (r.ls_override ?? "").trim() || (r.ls_profile ?? "").trim(),
      assignees: (Array.isArray(r.assignee_ids) ? r.assignee_ids : []).map((id) => nameById.get(id)).filter(Boolean) as string[],
      lastMessage: lastMsg.get(r.id) ?? null,
      activity: nextAct.get(r.id) ?? null,
    }));
    return NextResponse.json({ contacts: rows, total });
  } catch (err) {
    // Surfaced, not swallowed: a bad filter reads as an error on the page, never as
    // an empty list under a stale count.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Contacts search failed." }, { status: 500 });
  }
}

const addSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
  assigneeId: z.string().uuid().optional(),
});

// POST /api/sales/contacts — add a new contact (stored in the CRM mirror as source='manual').
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A contact name is required." }, { status: 400 });
  // Only managers may assign to someone else; reps own what they create. Since visibility
  // is Lead-assign based, the creator is added to assignee_ids so they can see it.
  const scope = await getSalesScope(profile);
  const ownerId = scope.isManager && parsed.data.assigneeId ? parsed.data.assigneeId : profile.id;
  // crm_contacts.external_id is NOT NULL (it keys Odoo-synced rows + annotations).
  // Manual adds have no external system, so mint a unique id — prefer the email
  // (natural dedupe key), else a generated one.
  const externalId = parsed.data.email?.trim().toLowerCase() || `manual:${crypto.randomUUID()}`;
  const { data, error } = await db()
    .from("crm_contacts")
    .insert({ name: parsed.data.name.trim(), email: parsed.data.email || null, company: parsed.data.company || null, phone: parsed.data.phone || null, source: "manual", external_id: externalId, owner_id: ownerId, assignee_ids: scope.isManager ? [] : [profile.id] })
    .select("id, name, email, company, phone, source")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
