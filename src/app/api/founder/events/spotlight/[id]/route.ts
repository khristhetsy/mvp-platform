import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { checkSpotlightFile } from "@/lib/icfo-events/spotlight/rules";
import { db, isOwnSpotlightPath, removeSpotlightVideo } from "@/lib/icfo-events/spotlight/service";

export const dynamic = "force-dynamic";

type Body = {
  videoPath?: string;
  videoType?: string;
  videoBytes?: number;
  videoSeconds?: number;
  videoWidth?: number;
  videoHeight?: number;
};

// PATCH /api/founder/events/spotlight/[id] — replace the pitch video on the
// founder's own Spotlight application while it is still in review (after staff
// ask for a change). Clears the old review so staff look again.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { profile } = auth;
  const { id } = await params;

  const { data: row } = await db()
    .from("speaker_applications")
    .select("id, event_id, applicant_id, status, kind, video_path")
    .eq("id", id)
    .maybeSingle();
  const app = row as Record<string, unknown> | null;
  if (!app || app.applicant_id !== profile.id || app.kind !== "founder_showcase") {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (app.status === "approved" || app.status === "declined") {
    return NextResponse.json({ error: "This application is already decided." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const eventId = String(app.event_id);
  if (!body?.videoPath || !isOwnSpotlightPath(body.videoPath, eventId, profile.id)) {
    return NextResponse.json({ error: "Upload the new video first." }, { status: 400 });
  }
  const checks = checkSpotlightFile({
    type: body.videoType ?? "",
    bytes: Number(body.videoBytes ?? 0),
    seconds: body.videoSeconds ?? null,
    width: body.videoWidth ?? null,
    height: body.videoHeight ?? null,
  });
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    return NextResponse.json({ error: `Fix the video: ${failed.map((c) => c.label.toLowerCase()).join(", ")}.` }, { status: 400 });
  }

  const { error } = await db()
    .from("speaker_applications")
    .update({
      video_path: body.videoPath,
      video_type: body.videoType,
      video_bytes: Math.round(Number(body.videoBytes)),
      video_seconds: Math.round(Number(body.videoSeconds)),
      video_width: Math.round(Number(body.videoWidth)),
      video_height: Math.round(Number(body.videoHeight)),
      status: "submitted",
      youtube_video_id: null,
      transcript: null,
      ai_review: null,
      ai_reviewed_at: null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the new video." }, { status: 500 });
  if (app.video_path && app.video_path !== body.videoPath) await removeSpotlightVideo(String(app.video_path));
  return NextResponse.json({ ok: true });
}
