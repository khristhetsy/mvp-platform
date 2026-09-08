/**
 * Chatter timeline for the Sales Hub (opportunity or contact detail).
 *  GET  ?opportunityId= | ?contactCrmId=  → { activity }
 *  POST { text, opportunityId?, contactCrmId? }  → log a free-text note
 * Send-message (email) uses the Gmail send route; tasks use /api/sales/tasks — both
 * already log to sales_activity_log, so they show up here on the next GET.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listOpportunityActivity, listContactActivity, logNote, type Activity } from "@/lib/sales/activity";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { fetchPartnerMessages } from "@/lib/crm-connectors/odoo/messages";

export const dynamic = "force-dynamic";

/**
 * Pull an Odoo contact's chatter (Send message + Log note) into the timeline. Read-only
 * and best-effort: any Odoo hiccup just returns nothing rather than breaking the panel.
 * Stable ids (`odoo:<msgId>`) mean a re-fetch never duplicates.
 */
async function odooChatterFor(contactCrmId: string): Promise<Activity[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = createServiceRoleClient();
    const { data: c } = await db.from("crm_contacts").select("source, external_id").eq("id", contactCrmId).maybeSingle();
    if (!c || c.source !== "odoo" || !c.external_id) return [];
    const msgs = await fetchPartnerMessages(String(c.external_id), 50);
    return msgs
      .filter((m) => m.body || m.subject)
      .map((m) => ({
        id: `odoo:${m.id}`,
        kind: (m.isNote ? "odoo_note" : "odoo_message") as Activity["kind"],
        summary: (m.subject && !m.isNote ? `${m.subject}\n` : "") + m.body,
        actor_name: m.author,
        created_at: m.date ?? new Date(0).toISOString(),
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const opportunityId = req.nextUrl.searchParams.get("opportunityId");
  const contactCrmId = req.nextUrl.searchParams.get("contactCrmId");

  if (opportunityId) {
    return NextResponse.json({ activity: await listOpportunityActivity(opportunityId) });
  }
  if (!contactCrmId) return NextResponse.json({ activity: [] });

  // Native iCapOS activity + imported Odoo chatter, merged newest-first.
  const [native, odoo] = await Promise.all([listContactActivity(contactCrmId), odooChatterFor(contactCrmId)]);
  const activity = [...native, ...odoo].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return NextResponse.json({ activity });
}

const postSchema = z.object({
  text: z.string().min(1).max(2000),
  opportunityId: z.string().uuid().optional().nullable(),
  contactCrmId: z.string().max(120).optional().nullable(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A note is required." }, { status: 400 });
  await logNote(parsed.data.text, { opportunityId: parsed.data.opportunityId, contactCrmId: parsed.data.contactCrmId, actorId: profile.id });
  return NextResponse.json({ ok: true });
}
