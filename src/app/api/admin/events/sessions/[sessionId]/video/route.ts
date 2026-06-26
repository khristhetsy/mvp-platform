import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { updateSession } from "@/lib/icfo-events/sessions";
import {
  EVENT_SESSION_VIDEO_BUCKET,
  SESSION_VIDEO_MAX_BYTES,
  SESSION_VIDEO_MIME,
  buildSessionVideoPath,
  uploadSessionVideo,
  sessionVideoSignedUrl,
} from "@/lib/icfo-events/video/storage";

export const dynamic = "force-dynamic";

/** Upload a recording for a session (staff). Multipart form: file + eventId. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sessionId } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const eventId = String(form.get("eventId") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json({ error: "eventId required." }, { status: 400 });
    }
    if (!SESSION_VIDEO_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported format. Use MP4, WebM, or MOV." }, { status: 415 });
    }
    if (file.size > SESSION_VIDEO_MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds the 500 MB limit." }, { status: 413 });
    }

    const path = buildSessionVideoPath(eventId, sessionId, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadSessionVideo({ supabase: auth.supabase, path, bytes, contentType: file.type });

    // Store the path + mark the session as recorded via the provider.
    const session = await updateSession(auth.supabase, sessionId, { recordingPath: path });
    const playbackUrl = await sessionVideoSignedUrl(path);

    track("event_session_video_uploaded", { userId: auth.profile.id, sessionId, eventId });
    return NextResponse.json({ session, playbackUrl, bucket: EVENT_SESSION_VIDEO_BUCKET }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload recording." }, { status: 500 });
  }
}
