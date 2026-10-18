/**
 * Counsel review of everything the AI IR Coach says to founders.
 *
 * The review pack is ALL founder facing wording: the course text, the coaching style lines, the
 * reminder messages, the email footer and the rules given to the AI. Its fingerprint (a SHA-256 of the
 * pack) is recorded when counsel signs off. Change any word and the fingerprint changes, so the coach
 * turns itself off for that course until counsel reviews the new wording. Nothing is trusted from a
 * browser: the fingerprint is always computed here, on the server.
 */
import { createHash } from "node:crypto";
import type { Course } from "@/lib/learning/course-types";
import { COACH_COURSES } from "@/lib/learning/coach/courses";
import { COACH_TONES, TONE_LABELS, TONE_LINES, type CoachTone } from "@/lib/learning/coach/tones";
import { COACH_EMAIL_REASON, QUIET_FOUNDER_DAYS, coachMessageCopy } from "@/lib/learning/coach/reminders";
import { buildCoachPromptAddendum } from "@/lib/learning/coach/ir-coach";
import { COACH_DISCLAIMER } from "@/lib/learning/class-assistant-guardrails";
import { NOT_A_BROKER_DEALER } from "@/lib/email/layout";

export type ReviewPack = {
  course: Course;
  styles: Array<{ tone: CoachTone; label: string; blurb: string; lines: Record<string, string> }>;
  reminders: Array<{ tone: CoachTone; kind: string; title: string; message: string }>;
  emailFooter: string[];
  aiRules: Array<{ tone: CoachTone; text: string }>;
  disclaimer: string;
};

export function buildReviewPack(course: Course): ReviewPack {
  const reminders: ReviewPack["reminders"] = [];
  for (const tone of COACH_TONES) {
    const check = coachMessageCopy({ kind: "commitment_check", commitmentTitle: "[the step the founder chose]" }, tone);
    reminders.push({ tone, kind: "Commitment check", ...check });
    for (const stage of [QUIET_FOUNDER_DAYS.inApp, QUIET_FOUNDER_DAYS.email]) {
      const quiet = coachMessageCopy({ kind: "quiet_founder", stage }, tone);
      reminders.push({ tone, kind: `Quiet founder, ${stage} days`, ...quiet });
    }
  }
  return {
    course,
    styles: COACH_TONES.map((tone) => ({ tone, ...TONE_LABELS[tone], lines: { ...TONE_LINES[tone] } })),
    reminders,
    emailFooter: [COACH_EMAIL_REASON, NOT_A_BROKER_DEALER],
    aiRules: COACH_TONES.map((tone) => ({ tone, text: buildCoachPromptAddendum({ tone, step: null, lessonTitle: null }) })),
    disclaimer: COACH_DISCLAIMER,
  };
}

/** JSON with sorted keys, so the same wording always gives the same fingerprint. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function reviewFingerprint(pack: ReviewPack): string {
  return createHash("sha256").update(stable(pack)).digest("hex");
}

/** Fingerprint of a coach format course's current wording, or null for any other course. */
export function currentReviewHash(courseKey: string): string | null {
  const course = COACH_COURSES.find((c) => c.slug === courseKey);
  return course ? reviewFingerprint(buildReviewPack(course)) : null;
}

/**
 * Whether the coach waits for a counsel sign off before it can be switched on.
 * Khris decided (Oct 18, 2026) that the course is education only and counsel review is not required.
 * Set this to true to bring the gate back: nothing else changes, the fingerprint, the review pack page,
 * the Record review form and the review trail all stay in place.
 */
export const COUNSEL_REVIEW_REQUIRED = false;

export type ReviewState = "not_reviewed" | "reviewed" | "changed" | "waived";

export function reviewState(input: {
  currentHash: string | null;
  reviewedHash: string | null | undefined;
  /** Defaults to COUNSEL_REVIEW_REQUIRED. Tests pass it to check both modes. */
  required?: boolean;
}): ReviewState {
  const required = input.required ?? COUNSEL_REVIEW_REQUIRED;
  // A course with no fingerprint is not a coach format course. It never counts, required or not.
  if (!required) return input.currentHash === null ? "not_reviewed" : "waived";
  if (!input.reviewedHash) return "not_reviewed";
  return input.currentHash !== null && input.reviewedHash === input.currentHash ? "reviewed" : "changed";
}

/** True when the review state lets the coach run: reviewed, or review not required. */
export function reviewAllowsCoach(state: ReviewState): boolean {
  return state === "reviewed" || state === "waived";
}

/** Enabled coach format courses that may run: reviewed when review is required, otherwise all of them. Used by the reminder pass. */
export function reviewedEnabledCourses(
  rows: Array<{ course_key: string; reviewed_hash: string | null }>,
  required: boolean = COUNSEL_REVIEW_REQUIRED,
): string[] {
  return rows
    .filter((r) => reviewAllowsCoach(reviewState({ currentHash: currentReviewHash(r.course_key), reviewedHash: r.reviewed_hash, required })))
    .map((r) => r.course_key);
}
