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
      { error: "Presenting at events is available on the Founder Pro and Premium plans.", upgrade: true },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.eventId || !body.topic?.trim()) {
    return NextResponse.json({ error: "Pick an event and enter a talk title." }, { status: 400 });
  }
  const topic = body.topic.trim().slice(0, 200);

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
