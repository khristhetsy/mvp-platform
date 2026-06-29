import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { resolveHelpRequest, listOpenHelpRequests } from "@/lib/icfo-events/help-desk";

export const dynamic = "force-dynamic";

/** Resolve a help request (staff). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, requestId } = await params;
    await resolveHelpRequest(auth.supabase, requestId, auth.profile.id);
    const open = await listOpenHelpRequests(auth.supabase, id);
    return NextResponse.json({ open });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to resolve." }, { status: 500 });
  }
}
