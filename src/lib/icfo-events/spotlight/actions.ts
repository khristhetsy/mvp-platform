// Staff decisions on a Spotlight application. Each one notifies the founder
// in app and logs event activity, like the existing speaker decision route.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { createPresenter } from "@/lib/icfo-events/applications";
import { logEventActivity } from "@/lib/icfo-events/activity";
import { awardPoints } from "@/lib/icfo-events/gamification";
import {
  db,
  ensureFounderBooth,
  getSpotlightApplication,
  nextLineupPosition,
  patchSpotlightApplication,
  removeSpotlightVideo,
} from "./service";

const FOUNDER_LINK = "/founder/events/present";

export class SpotlightActionError extends Error {}

export async function approveSpotlight(input: { applicationId: string; staffId: string; sessionId: string | null }) {
  const app = await getSpotlightApplication(input.applicationId);
  if (!app) throw new SpotlightActionError("Application not found.");
  if (app.status === "approved") throw new SpotlightActionError("Already approved.");
  if (!app.youtubeVideoId) {
    throw new SpotlightActionError("Add the YouTube video first, so the approved pitch can play at the event.");
  }

  const admin = createServiceRoleClient();
  const displayName = app.applicantName ?? app.company?.name ?? "Founder";

  let presenterId = app.presenterId;
  if (!presenterId) {
    const presenter = await createPresenter(admin, {
      eventId: app.eventId,
      applicationId: app.id,
      profileId: app.applicantId,
      sessionId: input.sessionId,
      displayName,
      roleLabel: app.company?.name ? `Founder, ${app.company.name}` : "Founder spotlight",
      headline: app.topic,
      companySummary: app.companySummary,
      links: app.company?.website ? [app.company.website] : [],
    });
    presenterId = presenter.id;
  }
  const position = await nextLineupPosition(app.eventId, input.sessionId);

  let boothId: string | null = app.boothSponsorId;
  if (app.wantsBooth) {
    boothId = await ensureFounderBooth({
      applicationId: app.id,
      eventId: app.eventId,
      ownerId: app.applicantId,
      name: app.company?.name ?? displayName,
      blurb: app.companySummary,
      website: app.company?.website ?? null,
      sectorSlug: app.sectorSlug,
      youtubeVideoId: app.youtubeVideoId,
    });
  }

  const { error } = await db()
    .from("event_presenters")
    .update({
      session_id: input.sessionId,
      position,
      youtube_video_id: app.youtubeVideoId,
      ai_intro: app.aiIntro,
      booth_sponsor_id: boothId,
    })
    .eq("id", presenterId);
  if (error) throw new Error(error.message);

  await db()
    .from("speaker_applications")
    .update({
      status: "approved",
      reviewer_id: input.staffId,
      decided_at: new Date().toISOString(),
      decision_note: null,
      booth_sponsor_id: boothId,
      // YouTube now holds the approved version, so the master file goes.
      video_path: null,
    })
    .eq("id", app.id);
  await removeSpotlightVideo(app.videoPath);

  await awardPoints(app.eventId, app.applicantId, "approved");
  await logEventActivity(admin, app.eventId, input.staffId, "presenter_approved", { applicationId: app.id, spotlight: true });
  await createNotification({
    recipientUserId: app.applicantId,
    actorUserId: input.staffId,
    type: "event_speaker_decision",
    title: "Your Spotlight pitch is approved",
    message: boothId
      ? `"${app.topic}" will play in the Founder Spotlight. Your booth is ready to finish.`
      : `"${app.topic}" will play in the Founder Spotlight.`,
    entityType: "speaker_application",
    entityId: app.id,
    deepLink: FOUNDER_LINK,
  });
  return { presenterId, boothId };
}

export async function requestSpotlightChange(input: { applicationId: string; staffId: string; note: string }) {
  const app = await getSpotlightApplication(input.applicationId);
  if (!app) throw new SpotlightActionError("Application not found.");
  if (app.status === "approved" || app.status === "declined") {
    throw new SpotlightActionError("This application is already decided.");
  }
  await patchSpotlightApplication(app.id, {
    status: "under_review",
    decision_note: input.note.slice(0, 1000),
    reviewer_id: input.staffId,
  });
  await createNotification({
    recipientUserId: app.applicantId,
    actorUserId: input.staffId,
    type: "event_speaker_decision",
    title: "A change is needed on your Spotlight pitch",
    message: `${input.note.slice(0, 300)} Upload a new video from Present at an event.`,
    entityType: "speaker_application",
    entityId: app.id,
    deepLink: FOUNDER_LINK,
  });
}

export async function declineSpotlight(input: { applicationId: string; staffId: string; note: string }) {
  const app = await getSpotlightApplication(input.applicationId);
  if (!app) throw new SpotlightActionError("Application not found.");
  if (app.status === "approved") throw new SpotlightActionError("Already approved.");
  await patchSpotlightApplication(app.id, {
    status: "declined",
    decision_note: input.note.slice(0, 1000),
    reviewer_id: input.staffId,
    decided_at: new Date().toISOString(),
  });
  await logEventActivity(createServiceRoleClient(), app.eventId, input.staffId, "presenter_declined", {
    applicationId: app.id,
    spotlight: true,
  });
  await createNotification({
    recipientUserId: app.applicantId,
    actorUserId: input.staffId,
    type: "event_speaker_decision",
    title: "Update on your Spotlight application",
    message: `"${app.topic}" wasn't selected this time. Note: ${input.note.slice(0, 300)}`,
    entityType: "speaker_application",
    entityId: app.id,
    deepLink: FOUNDER_LINK,
  });
}
