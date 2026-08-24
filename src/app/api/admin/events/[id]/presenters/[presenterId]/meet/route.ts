import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { createCalendarEventWithMeet } from "@/lib/integrations/google-calendar";
import { getPresenterById, updatePresenter } from "@/lib/icfo-events/applications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Create a Google Meet for a presenter's slot from the admin's connected Google
 * account. When the presenter has a scheduled start time, the Meet is attached to
 * a real calendar event at that time (so "Add to Google Calendar" lines up).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; presenterId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { presenterId } = await params;
    const presenter = await getPresenterById(auth.supabase, presenterId);
    if (!presenter) return NextResponse.json({ error: "Presenter not found." }, { status: 404 });

    const tok = await getValidGoogleAccessToken(auth.userId);
    if (!("accessToken" in tok) || !tok.accessToken) {
      return NextResponse.json(
        { error: "Connect your Google account in Settings → Integrations, or paste a Meet link." },
        { status: 400 },
      );
    }

    const start = presenter.startsAt ? new Date(presenter.startsAt) : new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const result = await createCalendarEventWithMeet(
      {
        title: `${presenter.displayName}${presenter.headline ? ` — ${presenter.headline}` : ""}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: presenter.timezone || "UTC",
      },
      tok.accessToken,
    );
    if (!result.meetUrl) {
      return NextResponse.json({ error: "Couldn't create a Meet link — paste one instead." }, { status: 502 });
    }
    const updated = await updatePresenter(auth.supabase, presenterId, { meetingUrl: result.meetUrl });
    return NextResponse.json({ presenter: updated, meetingUrl: result.meetUrl }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create meeting." }, { status: 500 });
  }
}
