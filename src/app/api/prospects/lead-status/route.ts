import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { LEAD_STATUSES, setLeadStatus, type LeadStatus } from "@/lib/prospects/lead-status";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
});

// POST /api/prospects/lead-status — human override of a contact's lead status.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await setLeadStatus(serviceRoleClientUntyped(), parsed.data.contactId, parsed.data.status as LeadStatus);
    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}
