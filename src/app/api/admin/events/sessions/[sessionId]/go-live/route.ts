import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { isLiveVideoConfigured } from "@/lib/icfo-events/video/whereby";
import { isHttpUrl } from "@/lib/icfo-events/video/external";
import { setSessionLiveRoom, endLiveSession } from "@/lib/icfo-events/sessions";

export const dynamic = "force-dynamic";

/** Start a live session. Two ways:
 *  - paste any live stream/meeting link (`liveUrl`) — fully internal, no vendor;
 *  - or, with WHEREBY_API_KEY set and no link given, provision a Whereby room. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { liveUrl?: string } | null;
  const liveUrl = body?.liveUrl?.trim();

  try {
    const { sessionId } = await params;

    // 1) Pasted link — internal, no vendor.
    if (liveUrl) {
      if (!isHttpUrl(liveUrl)) {
        return NextResponse.json({ error: "Enter a valid https link." }, { status: 400 });
      }
      const session = await setSessionLiveRoom(auth.supabase, sessionId, "external", liveUrl);
      track("event_session_went_live", { userId: auth.profile.id, sessionId });
      return NextResponse.json({ session, hostUrl: liveUrl });
    }

    // 2) Whereby room (only if configured and no link supplied).
    if (!isLiveVideoConfigured()) {
      return NextResponse.json(
        { error: "Add a live link, or set WHEREBY_API_KEY for built-in rooms." },
        { status: 503 },
      );
    }

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
