import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { createNotification } from "@/lib/notifications/notifications";
import { createConnectionRequest } from "@/lib/icfo-events/networking";
import { getEventById } from "@/lib/icfo-events/queries";

export const dynamic = "force-dynamic";

const schema = z.object({ eventId: z.string().uuid(), toProfileId: z.string().uuid() });

/** Request a networking connection with another attendee. */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    if (parsed.data.toProfileId === profile.id) {
      return NextResponse.json({ error: "You can't connect with yourself." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { id } = await createConnectionRequest(supabase, parsed.data.eventId, profile.id, parsed.data.toProfileId);

    const event = await getEventById(supabase, parsed.data.eventId).catch(() => null);
    await createNotification({
      recipientUserId: parsed.data.toProfileId,
      actorUserId: profile.id,
      type: "event_connection_request",
      title: "New connection request",
      message: `${profile.full_name ?? "Someone"} wants to connect with you${event ? ` at ${event.title}` : ""}.`,
      entityType: "networking_connection",
      entityId: id,
      deepLink: event ? `/events/${event.slug}` : "/events",
    });

    track("event_networking_connect", { userId: profile.id, eventId: parsed.data.eventId });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    if (detail.includes("duplicate key")) {
      return NextResponse.json({ error: "You've already requested this connection." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to send request." }, { status: 500 });
  }
}
