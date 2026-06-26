import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { createNotification } from "@/lib/notifications/notifications";
import { applicationDecisionSchema } from "@/lib/icfo-events/schemas";
import {
  getApplicationById,
  setApplicationDecision,
  createPresenter,
} from "@/lib/icfo-events/applications";
import { logEventActivity } from "@/lib/icfo-events/activity";
import { awardPoints } from "@/lib/icfo-events/gamification";
import type { SpeakerApplicationStatus } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

/** Staff decision on a speaker application: approve / decline / mark under review. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = applicationDecisionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { action, note, rubricScores, sessionId, roleLabel } = parsed.data;

    if (action === "decline" && !note?.trim()) {
      return NextResponse.json({ error: "A note is required when declining." }, { status: 400 });
    }

    const application = await getApplicationById(auth.supabase, id);
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const status: SpeakerApplicationStatus =
      action === "approve" ? "approved" : action === "decline" ? "declined" : "under_review";

    const updated = await setApplicationDecision(auth.supabase, id, auth.profile.id, status, {
      note: note ?? null,
      rubricScores,
    });

    // Approve → create a reusable presenter roster entry (optionally bound to a session).
    if (action === "approve") {
      await createPresenter(auth.supabase, {
        eventId: application.eventId,
        applicationId: application.id,
        profileId: application.applicantId,
        sessionId: sessionId ?? null,
        displayName: application.applicantName ?? "Presenter",
        roleLabel: roleLabel ?? application.kind.replace("_", " "),
        headline: application.topic,
        bio: application.bio,
        links: application.links,
      });
      await awardPoints(application.eventId, application.applicantId, "approved");
    }

    if (action !== "review") {
      await logEventActivity(
        auth.supabase,
        application.eventId,
        auth.profile.id,
        action === "approve" ? "presenter_approved" : "presenter_declined",
        { applicationId: application.id },
      );

      // Notify the applicant (in-app, no email dependency).
      const approved = action === "approve";
      await createNotification({
        recipientUserId: application.applicantId,
        actorUserId: auth.profile.id,
        type: "event_speaker_decision",
        title: approved ? "You're confirmed to present" : "Update on your speaker application",
        message: approved
          ? `Your application to present "${application.topic}" was approved.`
          : `Your application to present "${application.topic}" wasn't selected this time.${note ? ` Note: ${note.trim()}` : ""}`,
        entityType: "speaker_application",
        entityId: application.id,
        deepLink: "/events",
      });
    }

    track("event_presenter_decision", { userId: auth.profile.id, applicationId: id, action });
    return NextResponse.json({ application: updated });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to record decision." }, { status: 500 });
  }
}
