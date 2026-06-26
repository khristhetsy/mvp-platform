import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { track } from "@/lib/analytics/posthog";
import { awardPoints } from "@/lib/icfo-events/gamification";

export const dynamic = "force-dynamic";

const schema = z.object({ eventId: z.string().uuid() });

/** Record that the current user watched a session (awards view points once). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { sessionId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    // Idempotent per session — only the first view scores.
    await awardPoints(parsed.data.eventId, profile.id, "session_viewed", sessionId);
    track("event_session_viewed", { userId: profile.id, eventId: parsed.data.eventId, sessionId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to record view." }, { status: 500 });
  }
}
