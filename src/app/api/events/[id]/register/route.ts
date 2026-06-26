import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { createNotification } from "@/lib/notifications/notifications";
import { getEventById } from "@/lib/icfo-events/queries";
import { registerForEvent } from "@/lib/icfo-events/registrations";

export const dynamic = "force-dynamic";

/** Register the current user for an event. Idempotent. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const event = await getEventById(supabase, id);
    if (!event || !["published", "live", "ended"].includes(event.status)) {
      return NextResponse.json({ error: "Event not available for registration." }, { status: 404 });
    }

    const { registration, created } = await registerForEvent(supabase, id, profile.id);

    if (created) {
      await createNotification({
        recipientUserId: profile.id,
        type: "event_registration_confirmed",
        title: "You're registered",
        message: `You're confirmed for "${event.title}". We'll share the agenda and joining details here.`,
        entityType: "event",
        entityId: event.id,
        deepLink: `/events/${event.slug}`,
      });
      track("event_registered", { userId: profile.id, eventId: event.id });
    }

    return NextResponse.json({ registration, created }, { status: created ? 201 : 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to register." }, { status: 500 });
  }
}
