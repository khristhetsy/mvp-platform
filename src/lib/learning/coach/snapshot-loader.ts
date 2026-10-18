/**
 * Loads the five coach sources for one founder and company. Server only.
 * Every read is isolated: a failure marks that one source unavailable and never fails the others.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Course } from "@/lib/learning/course-types";
import { crrFor } from "@/lib/crr/crr-for";
import { improvementSteps } from "@/lib/crr/improvement";
import { getManualOutreach, getManualRecipients } from "@/lib/outreach/manual-outreach";
import { listEvents } from "@/lib/calendar/events";
import {
  calendarSource,
  courseProgressSource,
  fixListSource,
  manualOutreachSource,
  ratingSource,
  summarizeCourseSteps,
  type CoachSnapshot,
  type FixItem,
  type RatingInput,
  type StepEventInput,
} from "@/lib/learning/coach/data-reads";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIX_LIMIT = 3;

async function settle<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export async function loadCoachSnapshot(input: {
  supabase: SupabaseClient<Database>;
  founderId: string;
  companyId: string | null;
  course: Course;
  now?: Date;
}): Promise<CoachSnapshot> {
  const now = input.now ?? new Date();

  const [crr, manual, events, steps] = await Promise.all([
    settle(() => crrFor(input.companyId)),
    settle(async () => {
      if (!input.companyId) return { campaignStatus: null, recipients: [] };
      const [campaign, recipients] = await Promise.all([getManualOutreach(input.companyId), getManualRecipients(input.companyId)]);
      return { campaignStatus: campaign?.status ?? null, recipients };
    }),
    settle(() => listEvents(input.supabase, input.founderId, now.toISOString(), new Date(now.getTime() + 14 * DAY_MS).toISOString())),
    settle(async () => {
      if (!input.companyId) return [] as StepEventInput[];
      // Coach tables are not in the hand maintained types yet.
      const { data, error } = await (input.supabase as unknown as SupabaseClient)
        .from("coach_step_events")
        .select("lesson_id, step_index, event, created_at")
        .eq("founder_id", input.founderId)
        .eq("company_id", input.companyId)
        .eq("course_slug", input.course.slug)
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []) as StepEventInput[];
    }),
  ]);

  const rating: RatingInput | null = crr
    ? { score: crr.score, isOverridden: crr.isOverridden, gate: crr.gate, pointsToGate: crr.pointsToGate, outreachUnlocked: crr.outreachUnlocked, scoredAt: crr.scoredAt }
    : null;
  const fixes: FixItem[] | null = crr
    ? improvementSteps(crr.factorGaps, FIX_LIMIT).map((s) => ({ action: s.action, href: s.href, upTo: s.upTo }))
    : null;

  return {
    sources: [
      ratingSource(rating, now),
      fixListSource(fixes, crr ? crr.score !== null : false, now),
      manualOutreachSource(manual, now),
      calendarSource(events, now),
      courseProgressSource(steps ? summarizeCourseSteps(input.course, steps) : null, input.course.title, now),
    ],
  };
}
