import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { createNotification } from "@/lib/notifications/notifications";
import { listConnections } from "@/lib/icfo-events/networking";
import { getEventById } from "@/lib/icfo-events/queries";
import { createIntroductionRoom, meetingLinksAvailable } from "@/lib/icfo-events/meeting-links";

export const dynamic = "force-dynamic";

const schema = z.object({ eventId: z.string().uuid(), connectionId: z.string().uuid() });

/**
 * Start a 1:1 call with an accepted networking connection.
 *
 * The room comes from the platform's own video provider — the same one that
 * mints session rooms. It used to be created from the caller's connected
 * Google account, which meant the button failed for the many attendees who
 * have never connected Google, immediately after they accepted.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Only mutually-connected attendees can call each other.
    const connections = await listConnections(supabase, parsed.data.eventId, profile.id);
    const connection = connections.find((c) => c.id === parsed.data.connectionId && c.status === "accepted");
    if (!connection) {
      return NextResponse.json({ error: "You can only start a call with a connected attendee." }, { status: 403 });
    }

    if (!meetingLinksAvailable()) {
      return NextResponse.json(
        { error: "Video calls aren't available for this workspace yet. Use the conversation to arrange one." },
        { status: 503 },
      );
    }

    const room = await createIntroductionRoom({
      introductionId: connection.id,
      title: `iCFO Events — ${profile.full_name ?? "attendee"} & ${connection.otherName}`,
    });
    if (!room.ok) {
      // The connection stands whether or not a room could be made; say what
      // went wrong rather than implying the introduction failed.
      return NextResponse.json({ error: room.reason }, { status: 502 });
    }

    // Invite the other attendee to the same room.
    const event = await getEventById(supabase, parsed.data.eventId).catch(() => null);
    await createNotification({
      recipientUserId: connection.otherProfileId,
      actorUserId: profile.id,
      type: "event_networking_call",
      title: "Incoming video call",
      message: `${profile.full_name ?? "A connection"} is inviting you to a video call${event ? ` at ${event.title}` : ""}. Click to join.`,
      entityType: "networking_connection",
      entityId: connection.id,
      deepLink: room.room.url,
    });

    track("event_networking_call", { userId: profile.id, eventId: parsed.data.eventId });
    return NextResponse.json({ meetUrl: room.room.url, expiresAt: room.room.expiresAt });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't start the call." }, { status: 500 });
  }
}
