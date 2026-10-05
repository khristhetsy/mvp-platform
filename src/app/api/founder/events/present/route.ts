import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import {
  getSubscriptionForProfile,
  ensureSubscriptionForProfile,
  refreshSubscriptionState,
} from "@/lib/subscriptions/get-subscription";
import { createApplication } from "@/lib/icfo-events/applications";
import { presentTierForPlan } from "@/lib/icfo-events/present-tiers";
import type { SpeakerApplicationInput } from "@/lib/icfo-events/schemas";
import { checkSpotlightFile } from "@/lib/icfo-events/spotlight/rules";
import { db, isOwnSpotlightPath } from "@/lib/icfo-events/spotlight/service";
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
  videoUrl?: string;
  links?: string[];
  features?: string[];
  /** "spotlight" = a 3 minute uploaded pitch for the Founder Spotlight. */
  mode?: "spotlight";
  videoPath?: string;
  videoType?: string;
  videoBytes?: number;
  videoSeconds?: number;
  videoWidth?: number;
  videoHeight?: number;
  sectorSlug?: string;
  companySummary?: string;
  wantsBooth?: boolean;
  disclaimerAccepted?: boolean;
};

// POST /api/founder/events/present — submit an application to present at an
// iCFO event. Plan-gated: Basic → Spotlight, Professional → Full presentation.
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

  if (body.mode === "spotlight") return submitSpotlight(profile.id, profile.role, body, topic);

  const videoUrl = body.videoUrl?.trim();
  if (tier.requiresVideo && !videoUrl) {
    return NextResponse.json({ error: "A video presentation link is required for a full presentation." }, { status: 400 });
  }
  if (videoUrl && !isHttpUrl(videoUrl)) {
    return NextResponse.json({ error: "Enter a valid video URL (https://…)." }, { status: 400 });
  }

  const extraLinks = (body.links ?? []).map((l) => l.trim()).filter((l) => l && isHttpUrl(l));
  const links = [videoUrl, ...extraLinks].filter((v): v is string => Boolean(v)).slice(0, 6);

  const chosenIds = new Set(body.features ?? []);
  const featureLabels = tier.features.filter((f) => chosenIds.has(f.id)).map((f) => f.label);

  const bio = [
    body.bio?.trim() || null,
    `Presentation tier: ${tier.label}.`,
    videoUrl ? `Video: ${videoUrl}` : null,
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
    return NextResponse.json({ ok: true, applicationId: application.id, tier: tier.key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not submit your application.";
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ error: "You've already applied to present at this event." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// Founder Spotlight: every presenting plan can submit an uploaded 3 minute
// pitch. The video already sits in the founder's own folder of the private
// bucket (signed upload); this records the application for the studio queue.
async function submitSpotlight(profileId: string, role: string, body: Body, topic: string) {
  const eventId = body.eventId as string;
  if (!body.disclaimerAccepted) {
    return NextResponse.json({ error: "Confirm you have read the iCFO disclaimer." }, { status: 400 });
  }
  if (!body.videoPath || !isOwnSpotlightPath(body.videoPath, eventId, profileId)) {
    return NextResponse.json({ error: "Upload your pitch video first." }, { status: 400 });
  }
  const failed = checkSpotlightFile({
    type: body.videoType ?? "",
    bytes: Number(body.videoBytes ?? 0),
    seconds: body.videoSeconds ?? null,
    width: body.videoWidth ?? null,
    height: body.videoHeight ?? null,
  }).filter((c) => !c.ok);
  if (failed.length) {
    return NextResponse.json({ error: `Fix the video: ${failed.map((c) => c.label.toLowerCase()).join(", ")}.` }, { status: 400 });
  }

  const { data, error } = await db()
    .from("speaker_applications")
    .insert({
      event_id: eventId,
      applicant_id: profileId,
      applicant_role: role,
      kind: "founder_showcase",
      topic,
      bio: "Presentation tier: Founder Spotlight (3 minute video).",
      sector_slug: body.sectorSlug?.trim() || null,
      links: [],
      company_summary: body.companySummary?.trim().slice(0, 200) || null,
      wants_booth: Boolean(body.wantsBooth),
      disclaimer_accepted_at: new Date().toISOString(),
      video_path: body.videoPath,
      video_type: body.videoType,
      video_bytes: Math.round(Number(body.videoBytes)),
      video_seconds: Math.round(Number(body.videoSeconds)),
      video_width: Math.round(Number(body.videoWidth)),
      video_height: Math.round(Number(body.videoHeight)),
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
