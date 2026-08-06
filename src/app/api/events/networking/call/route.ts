import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { createNotification } from "@/lib/notifications/notifications";
import { listConnections } from "@/lib/icfo-events/networking";
import { getEventById } from "@/lib/icfo-events/queries";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { createCalendarEventWithMeet } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

const schema = z.object({ eventId: z.string().uuid(), connectionId: z.string().uuid() });

/**
 * Start a Google Meet 1:1 call with an accepted networking connection.
 * Google Meet can't be embedded, so this is a pop-out: the caller opens the Meet
 * in a new tab and the other attendee gets a notification with the same link.
 * The Meet is created from the caller's own connected Google account.
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

    // Create the Meet from the caller's connected Google account.
    const tok = await getValidGoogleAccessToken(profile.id);
    if (!("accessToken" in tok) || !tok.accessToken) {
      return NextResponse.json(
        { error: "Connect your Google account in Settings → Integrations to start a video call." },
        { status: 400 },
      );
    }

    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const result = await createCalendarEventWithMeet(
      {
        title: `iCFO Events — networking call with ${connection.otherName}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: "UTC",
      },
      tok.accessToken,
    );
    if (!result.meetUrl) {
      return NextResponse.json({ error: "Couldn't create a Meet link. Try again." }, { status: 502 });
    }

    // Invite the other attendee with the same Meet link.
    const event = await getEventById(supabase, parsed.data.eventId).catch(() => null);
    await createNotification({
      recipientUserId: connection.otherProfileId,
      actorUserId: profile.id,
      type: "event_networking_call",
      title: "Incoming video call",
      message: `${profile.full_name ?? "A connection"} is inviting you to a Google Meet${event ? ` at ${event.title}` : ""}. Click to join.`,
      entityType: "networking_connection",
      entityId: connection.id,
      deepLink: result.meetUrl,
    });

    track("event_networking_call", { userId: profile.id, eventId: parsed.data.eventId });
    return NextResponse.json({ meetUrl: result.meetUrl });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't start the call." }, { status: 500 });
  }
}
