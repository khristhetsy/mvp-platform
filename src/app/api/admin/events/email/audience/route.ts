import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getLists } from "@/lib/marketing/contacts";
import { resolveRegistrantCounts } from "@/lib/event-email/segments";

export const dynamic = "force-dynamic";

/** Audience options for the send step: existing CRM lists + registrant counts
 *  for the event (counts only — raw registrant lists never leave the server). */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const eventId = req.nextUrl.searchParams.get("eventId");
    const [lists, registrants] = await Promise.all([
      getLists().catch(() => []),
      eventId ? resolveRegistrantCounts(auth.supabase, eventId).catch(() => null) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      lists: lists.map((l) => ({ id: l.id, name: l.name })),
      registrants,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't load audience options." }, { status: 500 });
  }
}
