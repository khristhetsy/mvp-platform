import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { ATTENDEE_TYPES, type AttendeeType } from "@/lib/icfo-events/registration-intake";
import { invitationFromToken } from "@/lib/icfo-events/invitations/store";
import { loadEvents } from "@/lib/icfo-events/invitations/runner";
import { registerForEvents } from "@/lib/icfo-events/invitations/register";

export const dynamic = "force-dynamic";

/**
 * Register from an invitation link for one or more of the campaign's events.
 * Body: { eventIds, attendeeType, answers, interests }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const { token } = await params;
    const invitation = await invitationFromToken(decodeURIComponent(token));
    if (!invitation) return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const rl = checkRateLimit({ key: `event-invite-register:${ip}`, limit: 10, windowMs: 10 * 60_000 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = (await req.json().catch(() => null)) as { eventIds?: unknown; attendeeType?: string; answers?: Record<string, unknown>; interests?: unknown } | null;
    const attendeeType = body?.attendeeType && (ATTENDEE_TYPES as readonly string[]).includes(body.attendeeType) ? (body.attendeeType as AttendeeType) : null;
    if (!attendeeType) return NextResponse.json({ error: "Choose how you are attending." }, { status: 400 });
    const eventIds = Array.isArray(body?.eventIds) ? (body.eventIds as unknown[]).filter((x): x is string => typeof x === "string") : [];
    if (!eventIds.length) return NextResponse.json({ error: "Choose at least one event." }, { status: 400 });
    const interests = Array.isArray(body?.interests) ? (body.interests as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 24) : [];
    if (!interests.length) return NextResponse.json({ error: "Pick at least one networking interest." }, { status: 400 });

    const answers = body?.answers ?? {};
    const email = typeof answers.email === "string" ? answers.email.trim() : "";
    const name = typeof answers.name === "string" ? answers.name.trim() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    if (name.length < 2) return NextResponse.json({ error: "Your name is required." }, { status: 400 });

    const profile = await getCurrentUserProfile().catch(() => null);
    const events = await loadEvents(invitation.campaign.eventIds);
    const result = await registerForEvents({
      events,
      chosenIds: eventIds,
      profile: profile ? { id: profile.id, email: profile.email ?? null } : null,
      attendeeType,
      answers: { ...answers, email, name },
      interests,
      invitation,
    });
    return NextResponse.json(result, { status: result.registered.length ? 201 : 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to register." }, { status: 500 });
  }
}
