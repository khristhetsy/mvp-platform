import { FOUNDER_COURSES } from "@/lib/learning/courses";
import { COACH_COURSES } from "@/lib/learning/coach/courses";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import type { CoachTone } from "@/lib/learning/coach/tones";
import { currentReviewHash, reviewState, type ReviewState } from "@/lib/learning/coach/review-pack";

/** A course is ready for the coach only when it is in the coach format: every lesson has steps. */
export function isCoachReady(courseKey: string): boolean {
  const course = COACH_COURSES.find((c) => c.slug === courseKey);
  if (!course) return false;
  const lessons = course.sections.flatMap((s) => s.lessons);
  return lessons.length > 0 && lessons.every((l) => (l.steps?.length ?? 0) > 0);
}

export type CoachCourseRow = {
  key: string;
  title: string;
  source: "Coach format" | "Course catalog";
  ready: boolean;
  enabled: boolean;
  tone: string | null;
  /** Why the switch is disabled, shown next to it. */
  blocker: string | null;
  /** Counsel review of the wording that is live now. */
  review: ReviewState;
  reviewer: string | null;
  reviewedOn: string | null;
};

type Config = { course_key: string; enabled: boolean; tone: string | null; reviewed_hash?: string | null };
export type LatestReview = { course_key: string; reviewer_name: string; reviewed_on: string };

/**
 * Every course the coach could apply to. Courses outside the coach format are listed so the
 * gap is visible, but their switch stays off with the reason: never a control that cannot run.
 */
export function buildCoachCourseRows(configs: Config[], reviews: LatestReview[] = []): CoachCourseRow[] {
  const byKey = new Map(configs.map((c) => [c.course_key, c]));
  const rows: CoachCourseRow[] = [];
  for (const c of COACH_COURSES) {
    const cfg = byKey.get(c.slug);
    const review = reviewState({ currentHash: currentReviewHash(c.slug), reviewedHash: cfg?.reviewed_hash });
    const last = reviews.find((r) => r.course_key === c.slug) ?? null;
    const ready = isCoachReady(c.slug);
    rows.push({
      key: c.slug,
      title: c.title,
      source: "Coach format",
      ready: ready && review === "reviewed",
      enabled: cfg?.enabled === true,
      tone: cfg?.tone ?? null,
      blocker: !ready
        ? "Some lessons have no steps"
        : review === "not_reviewed"
          ? "Counsel has not reviewed this wording"
          : review === "changed"
            ? "Wording changed since counsel review"
            : null,
      review,
      reviewer: last?.reviewer_name ?? null,
      reviewedOn: last?.reviewed_on ?? null,
    });
  }
  for (const c of FOUNDER_COURSES) {
    if (rows.some((r) => r.key === c.slug)) continue;
    rows.push({
      key: c.slug,
      title: c.title,
      source: "Course catalog",
      ready: false,
      enabled: false,
      tone: null,
      blocker: "Lessons need steps first",
      review: "not_reviewed",
      reviewer: null,
      reviewedOn: null,
    });
  }
  return rows;
}

export type FounderForEnrollment = {
  id: string;
  email: string | null;
  role: string | null;
  companyId: string | null;
};

export type EnrollmentPlan = {
  enroll: Array<{ founderId: string; companyId: string }>;
  skipped: Array<{ founderId: string; reason: "no_company" | "already_active" | "not_a_founder" | "internal_account" }>;
};

/**
 * Who an admin action enrolls. "Selected" enrolls exactly the chosen founders, internal accounts
 * included (useful for testing, and they never receive real email). "All" skips internal accounts.
 */
export function planEnrollment(input: {
  mode: "selected" | "all";
  founders: FounderForEnrollment[];
  selectedIds?: string[];
  activeFounderIds: Set<string>;
}): EnrollmentPlan {
  const pool =
    input.mode === "all"
      ? input.founders
      : input.founders.filter((f) => (input.selectedIds ?? []).includes(f.id));
  const plan: EnrollmentPlan = { enroll: [], skipped: [] };
  for (const f of pool) {
    if (f.role !== "founder") plan.skipped.push({ founderId: f.id, reason: "not_a_founder" });
    else if (input.mode === "all" && isInternalAccount({ email: f.email, role: f.role })) plan.skipped.push({ founderId: f.id, reason: "internal_account" });
    else if (!f.companyId) plan.skipped.push({ founderId: f.id, reason: "no_company" });
    else if (input.activeFounderIds.has(f.id)) plan.skipped.push({ founderId: f.id, reason: "already_active" });
    else plan.enroll.push({ founderId: f.id, companyId: f.companyId });
  }
  return plan;
}

export type CoachFounderRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  companyId: string | null;
  status: "active" | "paused" | "ended" | "off";
  tone: CoachTone | null;
  source: string | null;
  lastActivity: string | null;
  /** Whole days with no coach step check in, for an active enrollment. Null when not enrolled or no data. */
  quietDays: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

function shortPacificDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(d);
}

export type FounderSource = { id: string; full_name: string | null; email: string | null };
export type EnrollmentSource = { founder_id: string; company_id: string; status: string; tone: string; source: string; started_at: string };

/**
 * One row per founder for the admin Founders tab. Quiet days count from the latest step check in,
 * or from the enrollment start when the founder has not checked in yet.
 */
export function buildCoachFounderRows(input: {
  founders: FounderSource[];
  companyByFounder: Map<string, { id: string; name: string }>;
  enrollments: EnrollmentSource[];
  lastStepAt: Map<string, string>;
  now: Date;
}): CoachFounderRow[] {
  const enrByFounder = new Map<string, EnrollmentSource>();
  for (const e of input.enrollments) {
    const prev = enrByFounder.get(e.founder_id);
    // An active enrollment wins; otherwise the most recently started one.
    if (!prev || (e.status === "active" && prev.status !== "active") || (prev.status !== "active" && e.started_at > prev.started_at)) {
      enrByFounder.set(e.founder_id, e);
    }
  }
  return input.founders.map((f) => {
    const co = input.companyByFounder.get(f.id) ?? null;
    const enr = enrByFounder.get(f.id) ?? null;
    const last = input.lastStepAt.get(f.id) ?? null;
    const status = enr && (enr.status === "active" || enr.status === "paused" || enr.status === "ended") ? enr.status : "off";
    const since = last ?? enr?.started_at ?? null;
    return {
      id: f.id,
      name: f.full_name ?? f.email ?? "Unknown",
      email: f.email ?? "",
      company: co?.name ?? "—",
      companyId: co?.id ?? null,
      status,
      tone: enr ? (enr.tone as CoachTone) : null,
      source: enr?.source ?? null,
      lastActivity: last ? shortPacificDate(new Date(last)) : null,
      quietDays: status === "active" && since ? wholeDaysBetween(new Date(since), input.now) : null,
    };
  });
}
