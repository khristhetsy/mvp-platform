import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  SPONSOR_VIDEO_MAX_BYTES,
  SPONSOR_VIDEO_MIME,
  buildSponsorVideoPath,
  uploadSponsorVideo,
  updateSponsorBooth,
  getOwnedSponsor,
  sponsorVideoSignedUrl,
} from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sponsor owner uploads their own booth video. Multipart form: file. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const owned = await getOwnedSponsor(supabase, id, profile.id);
    if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (!SPONSOR_VIDEO_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported format. Use MP4, WebM, or MOV." }, { status: 415 });
    }
    if (file.size > SPONSOR_VIDEO_MAX_BYTES) {
      return NextResponse.json({ error: "Video exceeds the 500 MB limit." }, { status: 413 });
    }

    // Owners aren't staff, so the storage write goes through the service role;
    // the sponsor row update is owner-scoped via RLS on the user client.
    const path = buildSponsorVideoPath(id, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadSponsorVideo(createServiceRoleClient(), path, bytes, file.type);
    const sponsor = await updateSponsorBooth(supabase, id, { videoProvider: "recorded", videoRef: path });
    const videoUrl = await sponsorVideoSignedUrl(path);

    return NextResponse.json({ sponsor, videoUrl }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload video." }, { status: 500 });
  }
}
