import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { createEventSchema } from "@/lib/icfo-events/schemas";
import { createEvent, listAllEvents } from "@/lib/icfo-events/queries";
import { logEventActivity } from "@/lib/icfo-events/activity";

export const dynamic = "force-dynamic";

/** List every event (staff). */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const events = await listAllEvents(auth.supabase);
    return NextResponse.json({ events });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load events." }, { status: 500 });
  }
}

/** Create a draft event (staff). */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = createEventSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const event = await createEvent(auth.supabase, auth.profile.id, parsed.data);
    await logEventActivity(auth.supabase, event.id, auth.profile.id, "created", { title: event.title });
    track("event_created", { userId: auth.profile.id, eventId: event.id, format: event.format });
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create event." }, { status: 500 });
  }
}
