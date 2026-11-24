import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { parseYouTubeId } from "@/lib/icfo-events/spotlight/rules";
import { db, getSpotlightApplication, patchSpotlightApplication } from "@/lib/icfo-events/spotlight/service";
import {
  SpotlightActionError,
  approveSpotlight,
  declineSpotlight,
  requestSpotlightChange,
} from "@/lib/icfo-events/spotlight/actions";

export const dynamic = "force-dynamic";

type Body = {
  action?: "youtube" | "approve" | "request_change" | "decline";
  youtube?: string;
  note?: string;
  sessionId?: string | null;
};

/** Spotlight studio actions on one application (staff with manage_events). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; applicationId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: eventId, applicationId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const app = await getSpotlightApplication(applicationId);
  if (!app || app.eventId !== eventId) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  try {
    switch (body.action) {
      case "youtube": {
        const raw = (body.youtube ?? "").trim();
        const youtubeId = raw ? parseYouTubeId(raw) : null;
        if (raw && !youtubeId) return NextResponse.json({ error: "Paste a YouTube link or the 11 character video id." }, { status: 400 });
        await patchSpotlightApplication(app.id, { youtube_video_id: youtubeId });
        if (app.presenterId) await db().from("event_presenters").update({ youtube_video_id: youtubeId }).eq("id", app.presenterId);
        return NextResponse.json({ youtubeVideoId: youtubeId });
      }
      case "approve": {
        const result = await approveSpotlight({ applicationId: app.id, staffId: auth.profile.id, sessionId: body.sessionId ?? null });
        return NextResponse.json(result);
      }
      case "request_change": {
        if (!body.note?.trim()) return NextResponse.json({ error: "Say what the founder should change." }, { status: 400 });
        await requestSpotlightChange({ applicationId: app.id, staffId: auth.profile.id, note: body.note.trim() });
        return NextResponse.json({ ok: true });
      }
      case "decline": {
        if (!body.note?.trim()) return NextResponse.json({ error: "A note is required when declining." }, { status: 400 });
        await declineSpotlight({ applicationId: app.id, staffId: auth.profile.id, note: body.note.trim() });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof SpotlightActionError) return NextResponse.json({ error: err.message }, { status: 409 });
    Sentry.captureException(err);
    return NextResponse.json({ error: "That didn't work. Try again." }, { status: 500 });
  }
}
