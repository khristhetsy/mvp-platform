import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { createCalendarEventWithMeet } from "@/lib/integrations/google-calendar";
import { getOwnedSponsor, updateSponsorBooth } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Sponsor owner generates a Google Meet link for their booth from their Google account. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const owned = await getOwnedSponsor(supabase, id, profile.id);
    if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const tok = await getValidGoogleAccessToken(profile.id);
    if (!("accessToken" in tok) || !tok.accessToken) {
      return NextResponse.json(
        { error: "Connect your Google account in Settings, or paste a Meet link." },
        { status: 400 },
      );
    }
    const start = new Date();
    const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
    const result = await createCalendarEventWithMeet(
      { title: `${owned.name} — booth meeting`, startTime: start.toISOString(), endTime: end.toISOString(), timezone: "UTC" },
      tok.accessToken,
    );
    if (!result.meetUrl) {
      return NextResponse.json({ error: "Couldn't create a Meet link — paste one instead." }, { status: 502 });
    }
    const sponsor = await updateSponsorBooth(supabase, id, { meetingUrl: result.meetUrl });
    return NextResponse.json({ sponsor, meetingUrl: result.meetUrl }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create meeting." }, { status: 500 });
  }
}
