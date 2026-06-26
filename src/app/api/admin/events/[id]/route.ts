import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { updateEventSchema } from "@/lib/icfo-events/schemas";
import { getEventById, updateEvent } from "@/lib/icfo-events/queries";
import { logEventActivity } from "@/lib/icfo-events/activity";

export const dynamic = "force-dynamic";

/** Get one event with its sectors + sessions (staff). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const event = await getEventById(auth.supabase, id);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ event });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load event." }, { status: 500 });
  }
}

/** Update event fields and/or sector tracks (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = updateEventSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const event = await updateEvent(auth.supabase, id, parsed.data);
    await logEventActivity(auth.supabase, id, auth.profile.id, "updated");
    track("event_updated", { userId: auth.profile.id, eventId: id });
    return NextResponse.json({ event });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}
