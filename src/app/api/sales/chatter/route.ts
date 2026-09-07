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
import { listOpportunityActivity, listContactActivity, logNote } from "@/lib/sales/activity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const opportunityId = req.nextUrl.searchParams.get("opportunityId");
  const contactCrmId = req.nextUrl.searchParams.get("contactCrmId");
  const activity = opportunityId
    ? await listOpportunityActivity(opportunityId)
    : contactCrmId ? await listContactActivity(contactCrmId) : [];
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
