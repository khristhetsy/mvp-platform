import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { createCalendarEventWithMeet } from "@/lib/integrations/google-calendar";
import { getSponsorById, updateSponsorBooth } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Generate a Google Meet link for a booth from the admin's connected Google account. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const tok = await getValidGoogleAccessToken(auth.userId);
    if (!("accessToken" in tok) || !tok.accessToken) {
      return NextResponse.json(
        { error: "Connect your Google account in Settings → Integrations, or paste a Meet link." },
        { status: 400 },
      );
    }
    const sponsor = await getSponsorById(auth.supabase, id);
    const start = new Date();
    const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); // reusable link for the day
    const result = await createCalendarEventWithMeet(
      { title: `${sponsor?.name ?? "Sponsor"} — booth meeting`, startTime: start.toISOString(), endTime: end.toISOString(), timezone: "UTC" },
      tok.accessToken,
    );
    if (!result.meetUrl) {
      return NextResponse.json({ error: "Couldn't create a Meet link — paste one instead." }, { status: 502 });
    }
    const updated = await updateSponsorBooth(auth.supabase, id, { meetingUrl: result.meetUrl });
    return NextResponse.json({ sponsor: updated, meetingUrl: result.meetUrl }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create meeting." }, { status: 500 });
  }
}
