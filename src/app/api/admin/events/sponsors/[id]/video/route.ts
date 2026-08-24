import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import {
  SPONSOR_VIDEO_MAX_BYTES,
  SPONSOR_VIDEO_MIME,
  buildSponsorVideoPath,
  uploadSponsorVideo,
  updateSponsorBooth,
  sponsorVideoSignedUrl,
} from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Upload a booth video for a sponsor (staff). Multipart form: file. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (!SPONSOR_VIDEO_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported format. Use MP4, WebM, or MOV." }, { status: 415 });
    }
    if (file.size > SPONSOR_VIDEO_MAX_BYTES) {
      return NextResponse.json({ error: "Video exceeds the 500 MB limit." }, { status: 413 });
    }

    const path = buildSponsorVideoPath(id, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadSponsorVideo(auth.supabase, path, bytes, file.type);
    const sponsor = await updateSponsorBooth(auth.supabase, id, { videoProvider: "recorded", videoRef: path });
    const videoUrl = await sponsorVideoSignedUrl(path);

    return NextResponse.json({ sponsor, videoUrl }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload video." }, { status: 500 });
  }
}
