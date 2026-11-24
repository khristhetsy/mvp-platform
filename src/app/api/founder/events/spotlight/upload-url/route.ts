import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import {
  getSubscriptionForProfile,
  ensureSubscriptionForProfile,
  refreshSubscriptionState,
} from "@/lib/subscriptions/get-subscription";
import { presentTierForPlan } from "@/lib/icfo-events/present-tiers";
import { PRESENTATION_VIDEO_MAX_BYTES, PRESENTATION_VIDEO_MIME } from "@/lib/icfo-events/spotlight/rules";
import { buildPresentationVideoPath, createPresentationUploadUrl } from "@/lib/icfo-events/spotlight/service";
import { EVENT_SESSION_VIDEO_BUCKET } from "@/lib/icfo-events/video/storage";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = { eventId?: string; fileName?: string; type?: string; bytes?: number };

// POST /api/founder/events/spotlight/upload-url — a one time signed upload URL
// (Full presentation only) so the browser sends the presentation video straight to the private bucket (the
// file never passes through our server, which caps request bodies).
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  let sub = await getSubscriptionForProfile(profile.id);
  if (!sub) sub = await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role });
  sub = await refreshSubscriptionState(sub);
  if (presentTierForPlan(sub.plan_type)?.key !== "full") {
    return NextResponse.json({ error: "A full presentation is included with the Professional plan.", upgrade: true }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.eventId || !body.fileName) return NextResponse.json({ error: "Pick an event and a video file." }, { status: 400 });
  // The event id becomes part of the storage path, so only a real id is accepted.
  if (!UUID.test(body.eventId)) return NextResponse.json({ error: "Pick an event." }, { status: 400 });
  if (!body.type || !PRESENTATION_VIDEO_MIME.includes(body.type)) {
    return NextResponse.json({ error: "Use an MP4, MOV or WebM video." }, { status: 415 });
  }
  if (!body.bytes || body.bytes > PRESENTATION_VIDEO_MAX_BYTES) {
    return NextResponse.json({ error: "The video must be 500 MB or less." }, { status: 413 });
  }

  const path = buildPresentationVideoPath(body.eventId, profile.id, body.fileName);
  const signed = await createPresentationUploadUrl(path);
  if (!signed) return NextResponse.json({ error: "Could not start the upload. Try again." }, { status: 500 });
  return NextResponse.json({ bucket: EVENT_SESSION_VIDEO_BUCKET, path: signed.path, token: signed.token });
}
