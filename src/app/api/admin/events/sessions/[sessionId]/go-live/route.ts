import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { isLiveVideoConfigured } from "@/lib/icfo-events/video/whereby";
import { setSessionLiveRoom, endLiveSession } from "@/lib/icfo-events/sessions";

export const dynamic = "force-dynamic";

/** Start a live session: provision a Whereby room and mark the session live. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLiveVideoConfigured()) {
    return NextResponse.json(
      { error: "Live video isn't configured yet. Add WHEREBY_API_KEY to enable it." },
      { status: 503 },
    );
  }

  try {
    const { sessionId } = await params;
    const provider = getVideoProvider("whereby");
    const room = (await provider.createRoom({ sessionId, title: "iCFO Events session" })) as {
      ref: string;
      joinUrl: string;
      hostUrl?: string;
    };

    const session = await setSessionLiveRoom(auth.supabase, sessionId, "whereby", room.ref);
    track("event_session_went_live", { userId: auth.profile.id, sessionId });

    return NextResponse.json({
      session,
      embedUrl: provider.embedUrl(room.ref),
      hostUrl: room.hostUrl ?? room.joinUrl,
    });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't start the live room. ${detail.slice(0, 300)}` }, { status: 500 });
  }
}

/** End a live session (status → ended). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const session = await endLiveSession(auth.supabase, sessionId);
    track("event_session_ended", { userId: auth.profile.id, sessionId });
    return NextResponse.json({ session });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't end the session." }, { status: 500 });
  }
}
