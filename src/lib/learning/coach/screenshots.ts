/**
 * Screenshot studio rules for the AI IR Coach. Pure functions: which steps need an image, what status
 * a step is in, what founders may see, and what approving does.
 *
 * Founders only ever see an approved image of a step whose screen has not changed since. A failed or
 * flagged capture, or a changed screen, hides the image until staff review it again.
 */
import type { Course } from "@/lib/learning/course-types";

export type CaptureTarget = {
  stepKey: string;
  courseSlug: string;
  lessonId: string;
  stepIndex: number;
  stepTitle: string;
  menuPath: string[];
  route: string;
  controlLabel: string | null;
  /** Value of the data-learning-id attribute on the control the pin points at. Null when the step names no single control. */
  learningId: string | null;
};

export function stepKey(courseSlug: string, lessonId: string, stepIndex: number): string {
  return `${courseSlug}:${lessonId}:${stepIndex}`;
}

export function buildCaptureTargets(course: Course): CaptureTarget[] {
  const out: CaptureTarget[] = [];
  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      (lesson.steps ?? []).forEach((step, i) => {
        out.push({
          stepKey: stepKey(course.slug, lesson.slug, i),
          courseSlug: course.slug,
          lessonId: lesson.slug,
          stepIndex: i,
          stepTitle: step.title,
          menuPath: step.menuPath,
          route: step.href,
          controlLabel: step.control ?? null,
          learningId: step.learningId ?? null,
        });
      });
    }
  }
  return out;
}

/** The metadata columns refreshed from the course. Capture and approval columns are never touched. */
export function syncRow(t: CaptureTarget) {
  return {
    step_key: t.stepKey,
    course_slug: t.courseSlug,
    lesson_id: t.lessonId,
    step_index: t.stepIndex,
    step_title: t.stepTitle,
    menu_path: t.menuPath,
    route: t.route,
    control_label: t.controlLabel,
    learning_id: t.learningId,
  };
}

export type ScreenshotRow = {
  step_key: string;
  course_slug: string;
  lesson_id: string;
  step_index: number;
  step_title: string;
  menu_path: string[];
  route: string;
  control_label: string | null;
  learning_id: string | null;
  image_path: string | null;
  content_hash: string | null;
  captured_at: string | null;
  app_version: string | null;
  pinned: boolean;
  capture_error: string | null;
  approved_image_path: string | null;
  approved_hash: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approved_captured_at: string | null;
  approved_app_version: string | null;
  needs_fix: boolean;
  needs_fix_note: string | null;
  capture_requested_at: string | null;
};

export type ScreenshotStatus = "captured" | "stale" | "missing" | "needs_fix";
export const STATUS_LABEL: Record<ScreenshotStatus, string> = {
  captured: "Captured",
  stale: "Stale",
  missing: "Missing",
  needs_fix: "Needs a fix",
};

type StatusFields = Pick<ScreenshotRow, "image_path" | "content_hash" | "approved_hash" | "capture_error" | "needs_fix">;

export function screenshotStatus(r: StatusFields): ScreenshotStatus {
  if (r.needs_fix || r.capture_error) return "needs_fix";
  if (!r.image_path) return "missing";
  if (r.approved_hash && r.approved_hash !== r.content_hash) return "stale";
  return "captured";
}

/** A new image is waiting for a person to approve it. */
export function awaitingApproval(r: StatusFields & Pick<ScreenshotRow, "approved_image_path">): boolean {
  return Boolean(r.image_path) && !r.capture_error && !r.needs_fix && r.approved_image_path !== r.image_path;
}

/** Founders see the approved image only while the screen it shows is still current. */
export function founderVisible(r: StatusFields & Pick<ScreenshotRow, "approved_image_path">): boolean {
  return Boolean(r.approved_image_path) && screenshotStatus(r) === "captured";
}

/** Approving publishes the latest capture. Returns null when there is nothing safe to approve. */
export function approvalPatch(r: Pick<ScreenshotRow, "image_path" | "content_hash" | "captured_at" | "app_version" | "capture_error">, userId: string, now: Date) {
  if (!r.image_path || r.capture_error) return null;
  return {
    approved_image_path: r.image_path,
    approved_hash: r.content_hash,
    approved_captured_at: r.captured_at,
    approved_app_version: r.app_version,
    approved_at: now.toISOString(),
    approved_by: userId,
    needs_fix: false,
    needs_fix_note: null,
  };
}

export type ScreenshotFilter = "all" | ScreenshotStatus | "awaiting";

export function filterScreenshots<T extends StatusFields & Pick<ScreenshotRow, "approved_image_path">>(rows: T[], filter: ScreenshotFilter): T[] {
  if (filter === "all") return rows;
  if (filter === "awaiting") return rows.filter(awaitingApproval);
  return rows.filter((r) => screenshotStatus(r) === filter);
}

export function countByStatus(rows: StatusFields[]): Record<ScreenshotStatus, number> {
  const n: Record<ScreenshotStatus, number> = { captured: 0, stale: 0, missing: 0, needs_fix: 0 };
  for (const r of rows) n[screenshotStatus(r)] += 1;
  return n;
}
