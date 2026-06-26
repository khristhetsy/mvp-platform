import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { publishEventSchema } from "@/lib/icfo-events/schemas";
import { getEventById, setEventStatus } from "@/lib/icfo-events/queries";
import { logEventActivity } from "@/lib/icfo-events/activity";
import type { EventStatus, EventActivityType } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

const ACTION_TO_STATUS: Record<string, EventStatus> = {
  publish: "published",
  unpublish: "draft",
  archive: "archived",
};
const ACTION_TO_ACTIVITY: Record<string, EventActivityType> = {
  publish: "published",
  unpublish: "unpublished",
  archive: "archived",
};

/** Move an event between lifecycle states (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = publishEventSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await getEventById(auth.supabase, id);
    if (!existing) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    // Guard: don't publish an event with no sector tracks (curation = the product).
    if (parsed.data.action === "publish" && existing.sectors.length === 0) {
      return NextResponse.json(
        { error: "Add at least one sector track before publishing." },
        { status: 422 },
      );
    }

    const status = ACTION_TO_STATUS[parsed.data.action];
    const event = await setEventStatus(auth.supabase, id, status);
    await logEventActivity(auth.supabase, id, auth.profile.id, ACTION_TO_ACTIVITY[parsed.data.action]);
    track("event_status_changed", { userId: auth.profile.id, eventId: id, action: parsed.data.action });
    return NextResponse.json({ event });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update event status." }, { status: 500 });
  }
}
