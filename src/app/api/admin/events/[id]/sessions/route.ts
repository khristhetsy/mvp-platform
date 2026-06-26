import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { sessionInput } from "@/lib/icfo-events/schemas";
import { createSession } from "@/lib/icfo-events/sessions";
import { logEventActivity } from "@/lib/icfo-events/activity";

export const dynamic = "force-dynamic";

/** Add a session to an event (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = sessionInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const session = await createSession(auth.supabase, id, parsed.data);
    await logEventActivity(auth.supabase, id, auth.profile.id, "session_added", { sessionId: session.id });
    track("event_session_added", { userId: auth.profile.id, eventId: id, type: session.type });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to add session." }, { status: 500 });
  }
}
