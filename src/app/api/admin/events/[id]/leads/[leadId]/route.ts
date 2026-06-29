import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { setLeadStatus } from "@/lib/icfo-events/leads";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["open", "contacted", "won", "lost"]) });

/** Move a lead along the pipeline (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { leadId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const lead = await setLeadStatus(auth.supabase, leadId, parsed.data.status);
    return NextResponse.json({ lead });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }
}
