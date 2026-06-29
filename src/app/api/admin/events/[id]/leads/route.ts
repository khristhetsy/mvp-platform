import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listEventLeads } from "@/lib/icfo-events/leads";

export const dynamic = "force-dynamic";

/** List an event's sponsor / service-provider leads (staff). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const leads = await listEventLeads(auth.supabase, id);
    return NextResponse.json({ leads });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load leads." }, { status: 500 });
  }
}
