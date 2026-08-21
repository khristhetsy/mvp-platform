import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { setLeadStatus, setLeadContact } from "@/lib/icfo-events/leads";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["open", "contacted", "won", "lost"]).optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
});

/** Update a lead: pipeline status and/or contact details (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { leadId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    const { status, contactName, contactEmail, contactPhone } = parsed.data;
    let lead = status ? await setLeadStatus(auth.supabase, leadId, status) : null;
    if (contactName !== undefined || contactEmail !== undefined || contactPhone !== undefined) {
      lead = await setLeadContact(auth.supabase, leadId, { contactName, contactEmail, contactPhone });
    }
    if (!lead) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    return NextResponse.json({ lead });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }
}
