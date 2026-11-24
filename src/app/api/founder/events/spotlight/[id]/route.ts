import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { parseYouTubeId } from "@/lib/icfo-events/spotlight/rules";
import { db } from "@/lib/icfo-events/spotlight/service";

export const dynamic = "force-dynamic";

type Body = { youtubeUrl?: string };

// PATCH /api/founder/events/spotlight/[id] — send a new YouTube link on the
// founder's own Spotlight application while it is still in review (after staff
// ask for a change). The slot stays; staff look at the new link.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { profile } = auth;
  const { id } = await params;

  const { data: row } = await db()
    .from("speaker_applications")
    .select("id, applicant_id, status, kind")
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
  const youtubeId = body?.youtubeUrl ? parseYouTubeId(body.youtubeUrl) : null;
  if (!youtubeId) return NextResponse.json({ error: "Paste a YouTube link to your 1 minute pitch." }, { status: 400 });

  const { error } = await db()
    .from("speaker_applications")
    .update({ youtube_video_id: youtubeId, status: "submitted", decision_note: null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the new link." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
