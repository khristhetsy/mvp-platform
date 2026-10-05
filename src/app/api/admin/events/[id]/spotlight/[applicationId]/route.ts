import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { isAiBudgetExceeded } from "@/lib/ai-budget/service";
import { isClaudeConfigured } from "@/lib/claude";
import { parseYouTubeId } from "@/lib/icfo-events/spotlight/rules";
import { draftSpotlightIntro, runSpotlightReview } from "@/lib/icfo-events/spotlight/review";
import { db, getSpotlightApplication, patchSpotlightApplication } from "@/lib/icfo-events/spotlight/service";
import {
  SpotlightActionError,
  approveSpotlight,
  declineSpotlight,
  requestSpotlightChange,
} from "@/lib/icfo-events/spotlight/actions";
import { sectorLabel } from "@/lib/icfo-events/sectors";

export const dynamic = "force-dynamic";

type Body = {
  action?: "youtube" | "transcript" | "review" | "intro_draft" | "intro" | "approve" | "request_change" | "decline";
  youtube?: string;
  transcript?: string;
  intro?: string;
  note?: string;
  sessionId?: string | null;
};

/** Spotlight studio actions on one application (staff with manage_events). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; applicationId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: eventId, applicationId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const app = await getSpotlightApplication(applicationId);
  if (!app || app.eventId !== eventId) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  try {
    switch (body.action) {
      case "youtube": {
        const raw = (body.youtube ?? "").trim();
        const youtubeId = raw ? parseYouTubeId(raw) : null;
        if (raw && !youtubeId) return NextResponse.json({ error: "Paste a YouTube link or the 11 character video id." }, { status: 400 });
        await patchSpotlightApplication(app.id, { youtube_video_id: youtubeId });
        if (app.presenterId) await db().from("event_presenters").update({ youtube_video_id: youtubeId }).eq("id", app.presenterId);
        return NextResponse.json({ youtubeVideoId: youtubeId });
      }
      case "transcript": {
        const transcript = (body.transcript ?? "").trim().slice(0, 20000) || null;
        await patchSpotlightApplication(app.id, { transcript });
        return NextResponse.json({ ok: true });
      }
      case "review": {
        if (!app.transcript) return NextResponse.json({ error: "Paste the YouTube captions transcript first." }, { status: 400 });
        if (!isClaudeConfigured()) return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
        const review = await runSpotlightReview({
          transcript: app.transcript,
          type: app.videoType ?? "",
          bytes: app.videoBytes ?? 0,
          seconds: app.videoSeconds,
          width: app.videoWidth,
          height: app.videoHeight,
          companyName: app.company?.name ?? null,
          topic: app.topic,
        });
        const reviewedAt = new Date().toISOString();
        await patchSpotlightApplication(app.id, {
          ai_review: review,
          ai_reviewed_at: reviewedAt,
          ...(app.status === "submitted" ? { status: "under_review" as const } : {}),
        });
        return NextResponse.json({ review, reviewedAt });
      }
      case "intro_draft": {
        if (!isClaudeConfigured()) return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
        // Draft only: staff edit it and press Save, which is the write.
        const intro = await draftSpotlightIntro({
          founderName: app.applicantName,
          companyName: app.company?.name ?? null,
          sector: app.sectorSlug ? sectorLabel(app.sectorSlug) : (app.company?.industry ?? null),
          stage: app.company?.fundingStage ?? null,
          summary: app.companySummary,
          topic: app.topic,
        });
        return NextResponse.json({ intro });
      }
      case "intro": {
        const intro = (body.intro ?? "").replace(/\s+/g, " ").trim().slice(0, 400) || null;
        await patchSpotlightApplication(app.id, { ai_intro: intro });
        if (app.presenterId) await db().from("event_presenters").update({ ai_intro: intro }).eq("id", app.presenterId);
        return NextResponse.json({ intro });
      }
      case "approve": {
        const result = await approveSpotlight({ applicationId: app.id, staffId: auth.profile.id, sessionId: body.sessionId ?? null });
        return NextResponse.json(result);
      }
      case "request_change": {
        if (!body.note?.trim()) return NextResponse.json({ error: "Say what the founder should change." }, { status: 400 });
        await requestSpotlightChange({ applicationId: app.id, staffId: auth.profile.id, note: body.note.trim() });
        return NextResponse.json({ ok: true });
      }
      case "decline": {
        if (!body.note?.trim()) return NextResponse.json({ error: "A note is required when declining." }, { status: 400 });
        await declineSpotlight({ applicationId: app.id, staffId: auth.profile.id, note: body.note.trim() });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof SpotlightActionError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (isAiBudgetExceeded(err)) return NextResponse.json({ error: err.message }, { status: 402 });
    Sentry.captureException(err);
    return NextResponse.json({ error: "That didn't work. Try again." }, { status: 500 });
  }
}
