import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { registerGuest } from "@/lib/icfo-events/registration-matches-server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { createNotification } from "@/lib/notifications/notifications";
import { publishedBookletUrl } from "@/lib/event-hub/brochure/editions";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { registerForEvent } from "@/lib/icfo-events/registrations";
import { upsertOptin } from "@/lib/icfo-events/networking";
import { awardPoints } from "@/lib/icfo-events/gamification";
import { applyRegistrationIntake, ATTENDEE_TYPES, type AttendeeType } from "@/lib/icfo-events/registration-intake";

export const dynamic = "force-dynamic";

/** Register for an event. Idempotent. Optional typed intake body:
 *  { attendeeType, answers, interests }.
 *
 *  Signed in: registers the current user, as before. Not signed in: registers a
 *  guest (no account) from the answers; name, email and role are required, and
 *  repeat submissions with the same email update the same guest row. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const profile = await getCurrentUserProfile().catch(() => null);
  try {
    const { slug } = await params;
    const supabase = await createServerSupabaseClient();

    const event = await getEventBySlug(supabase, slug);
    if (!event || !["published", "live", "ended"].includes(event.status)) {
      return NextResponse.json({ error: "Event not available for registration." }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as { attendeeType?: string; answers?: Record<string, unknown>; interests?: unknown } | null;
    const attendeeType =
      body?.attendeeType && (ATTENDEE_TYPES as readonly string[]).includes(body.attendeeType)
        ? (body.attendeeType as AttendeeType)
        : null;

    // Networking is part of registration now: at least one interest is required.
    const interests = Array.isArray(body?.interests)
      ? (body.interests as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 24)
      : [];
    if (interests.length === 0) {
      return NextResponse.json({ error: "Pick at least one networking interest." }, { status: 400 });
    }

    if (!profile) {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
      const rl = checkRateLimit({ key: `event-guest-register:${ip}`, limit: 10, windowMs: 10 * 60_000 });
      if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);
      const answers = body?.answers ?? {};
      const email = typeof answers.email === "string" ? answers.email.trim() : "";
      const name = typeof answers.name === "string" ? answers.name.trim() : "";
      if (!attendeeType) return NextResponse.json({ error: "Choose how you are attending." }, { status: 400 });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
      if (name.length < 2) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
      const { created } = await registerGuest(event.id, attendeeType, { ...answers, email, name });
      if (created) track("event_registered", { eventId: event.id, guest: true });
      return NextResponse.json({ guest: true, created }, { status: created ? 201 : 200 });
    }

    const { registration, created } = await registerForEvent(supabase, event.id, profile.id);

    // Everyone who registers is in networking (opted in) with their chosen interests.
    await upsertOptin(supabase, event.id, profile.id, true, interests).catch(() => null);

    if (attendeeType) {
      await applyRegistrationIntake({
        supabase,
        eventId: event.id,
        eventTitle: event.title,
        profileId: profile.id,
        attendeeType,
        answers: body?.answers ?? {},
      });
    }

    if (created) {
      // If a booklet is published for this event, point the confirmation straight
      // at it so registrants can download it right away ("" baseUrl → relative path).
      const bookletPath = await publishedBookletUrl(supabase, event.id, "").catch(() => null);
      await createNotification({
        recipientUserId: profile.id,
        type: "event_registration_confirmed",
        title: "You're registered",
        message: bookletPath
          ? `You're confirmed for "${event.title}". Your event booklet is ready — download it any time.`
          : `You're confirmed for "${event.title}". We'll share the agenda and joining details here.`,
        entityType: "event",
        entityId: event.id,
        deepLink: bookletPath ?? `/events/${event.slug}`,
      });
      track("event_registered", { userId: profile.id, eventId: event.id });
      await awardPoints(event.id, profile.id, "register");
    }

    return NextResponse.json({ registration, created }, { status: created ? 201 : 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to register." }, { status: 500 });
  }
}
