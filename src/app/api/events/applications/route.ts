import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { speakerApplicationSchema } from "@/lib/icfo-events/schemas";
import { createApplication } from "@/lib/icfo-events/applications";

export const dynamic = "force-dynamic";

/** Founder/investor applies to present at an event. */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireUserProfile();
  const role = String(profile.role ?? "").toLowerCase();
  if (role !== "founder" && role !== "investor") {
    return NextResponse.json(
      { error: "Only founders and investors can apply to present." },
      { status: 403 },
    );
  }

  try {
    const parsed = speakerApplicationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Insert under the caller's session so RLS owner-insert applies.
    const supabase = await createServerSupabaseClient();
    const application = await createApplication(supabase, profile.id, role, parsed.data);

    await notifyStaffIfNotRecent({
      actorUserId: profile.id,
      type: "event_speaker_application",
      title: "New speaker application",
      message: `${profile.full_name ?? profile.email ?? "A member"} applied to present: "${application.topic}".`,
      entityType: "speaker_application",
      entityId: application.id,
      deepLink: "/admin/events/applications",
      withinHours: 1,
    });
    track("event_presenter_applied", { userId: profile.id, eventId: application.eventId, kind: application.kind });

    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    // Unique violation → already applied.
    if (detail.includes("duplicate key")) {
      return NextResponse.json({ error: "You've already applied to present at this event." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to submit application." }, { status: 500 });
  }
}
