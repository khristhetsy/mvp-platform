import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import {
  getSubscriptionForProfile,
  ensureSubscriptionForProfile,
  refreshSubscriptionState,
} from "@/lib/subscriptions/get-subscription";
import { createApplication } from "@/lib/icfo-events/applications";
import { canSpotlight, presentTierForPlan } from "@/lib/icfo-events/present-tiers";
import type { SpeakerApplicationInput } from "@/lib/icfo-events/schemas";
import { checkPresentationFile, parseYouTubeId } from "@/lib/icfo-events/spotlight/rules";
import { db, isOwnPresentationPath } from "@/lib/icfo-events/spotlight/service";
import { registerForEvent } from "@/lib/icfo-events/registrations";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type Body = {
  eventId?: string;
  topic?: string;
  bio?: string;
  links?: string[];
  features?: string[];
  /** "spotlight" = a 1 minute pitch from a YouTube link for the Founder Spotlight. */
  mode?: "spotlight";
  /** Spotlight: the YouTube link (or 11 character id). */
  youtubeUrl?: string;
  /** Full presentation: the uploaded video in the private bucket. */
  videoPath?: string;
  videoType?: string;
  videoBytes?: number;
  sectorSlug?: string;
  companySummary?: string;
  wantsBooth?: boolean;
  disclaimerAccepted?: boolean;
};

// POST /api/founder/events/present — submit an application to present at an
// iCFO event. Plan-gated: Basic → Founder Spotlight, Professional → Full presentation.
// Writes a speaker_applications row (RLS: applicant inserts their own), which
// lands in the existing staff review queue at /admin/events/applications.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  let sub = await getSubscriptionForProfile(profile.id);
  if (!sub) sub = await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role });
  sub = await refreshSubscriptionState(sub);

  const tier = presentTierForPlan(sub.plan_type);
  if (!tier) {
    return NextResponse.json(
      { error: "Presenting at events is available on the Basic and Professional plans.", upgrade: true },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.eventId || !body.topic?.trim()) {
    return NextResponse.json({ error: "Pick an event and enter a talk title." }, { status: 400 });
  }
  const topic = body.topic.trim().slice(0, 200);

  if (body.mode === "spotlight") {
    if (!canSpotlight(sub.plan_type)) {
      return NextResponse.json({ error: "The Founder Spotlight is included with the Basic plan.", upgrade: true }, { status: 403 });
    }
    return submitSpotlight(profile.id, profile.role, body, topic);
  }
  if (tier.key !== "full") {
    return NextResponse.json({ error: "A full presentation is included with the Professional plan.", upgrade: true }, { status: 403 });
  }

  const eventId = body.eventId;
  if (!body.videoPath || !isOwnPresentationPath(body.videoPath, eventId, profile.id)) {
    return NextResponse.json({ error: "Upload your presentation video first." }, { status: 400 });
  }
  const failedChecks = checkPresentationFile({ type: body.videoType ?? "", bytes: Number(body.videoBytes ?? 0) }).filter((c) => !c.ok);
  if (failedChecks.length) {
    return NextResponse.json({ error: `Fix the video: ${failedChecks.map((c) => c.label.toLowerCase()).join(", ")}.` }, { status: 400 });
  }

  const links = (body.links ?? []).map((l) => l.trim()).filter((l) => l && isHttpUrl(l)).slice(0, 6);

  const chosenIds = new Set(body.features ?? []);
  const featureLabels = tier.features.filter((f) => chosenIds.has(f.id)).map((f) => f.label);

  const bio = [
    body.bio?.trim() || null,
    `Presentation tier: ${tier.label}.`,
    "Video: uploaded.",
    featureLabels.length ? `Requested features: ${featureLabels.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3000);

  const input: SpeakerApplicationInput = {
    eventId: body.eventId,
    kind: tier.kind,
    topic,
    bio,
    sectorSlug: null,
    links,
  };

  try {
    const application = await createApplication(supabase, profile.id, profile.role, input);
    // The uploaded file lives in the private bucket; staff watch it from the review queue.
    const { error: videoError } = await db()
      .from("speaker_applications")
      .update({ video_path: body.videoPath, video_type: body.videoType, video_bytes: Math.round(Number(body.videoBytes)) })
      .eq("id", application.id);
    if (videoError) return NextResponse.json({ error: "Could not save your video." }, { status: 500 });
    return NextResponse.json({ ok: true, applicationId: application.id, tier: tier.key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not submit your application.";
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ error: "You've already applied to present at this event." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// Founder Spotlight: a 1 minute pitch from the founder's own YouTube link. No
// upload and no editing: the video plays as posted and stops at 60 seconds. One
// application row is one slot, created here and shown in the studio queue.
async function submitSpotlight(profileId: string, role: string, body: Body, topic: string) {
  const eventId = body.eventId as string;
  if (!body.disclaimerAccepted) {
    return NextResponse.json({ error: "Confirm you have read the iCFO disclaimer." }, { status: 400 });
  }
  const youtubeId = body.youtubeUrl ? parseYouTubeId(body.youtubeUrl) : null;
  if (!youtubeId) {
    return NextResponse.json({ error: "Paste a YouTube link to your 1 minute pitch." }, { status: 400 });
  }

  const { data, error } = await db()
    .from("speaker_applications")
    .insert({
      event_id: eventId,
      applicant_id: profileId,
      applicant_role: role,
      kind: "founder_showcase",
      topic,
      bio: "Presentation tier: Founder Spotlight (1 minute YouTube pitch).",
      sector_slug: body.sectorSlug?.trim() || null,
      links: [],
      company_summary: body.companySummary?.trim().slice(0, 200) || null,
      wants_booth: Boolean(body.wantsBooth),
      disclaimer_accepted_at: new Date().toISOString(),
      youtube_video_id: youtubeId,
    })
    .select("id")
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: "You've already applied to the Spotlight at this event." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not submit your application." }, { status: 400 });
  }
  // Presenters must be registered for the event, so they also get match
  // networking. Registering is idempotent; a failure never loses the application.
  await registerForEvent(createServiceRoleClient(), eventId, profileId).catch(() => undefined);
  return NextResponse.json({ ok: true, applicationId: (data as { id: string }).id, tier: "spotlight" });
}
