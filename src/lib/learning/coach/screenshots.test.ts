import { describe, expect, it } from "vitest";
import {
  approvalPatch,
  awaitingApproval,
  buildCaptureTargets,
  countByStatus,
  filterScreenshots,
  founderVisible,
  screenshotStatus,
  stepKey,
  syncRow,
  type ScreenshotRow,
} from "./screenshots";
import { OUTREACH_PLAYBOOK } from "@/lib/learning/outreach-playbook";

const row = (o: Partial<ScreenshotRow> = {}): ScreenshotRow => ({
  step_key: "c:l:0", course_slug: "c", lesson_id: "l", step_index: 0, step_title: "T", menu_path: ["A"], route: "/x",
  control_label: null, learning_id: null,
  image_path: null, content_hash: null, captured_at: null, app_version: null, pinned: false, capture_error: null,
  approved_image_path: null, approved_hash: null, approved_at: null, approved_by: null, approved_captured_at: null, approved_app_version: null,
  needs_fix: false, needs_fix_note: null, capture_requested_at: null,
  ...o,
});

describe("capture targets", () => {
  it("makes one target per playbook step, in course order, with unique keys", () => {
    const targets = buildCaptureTargets(OUTREACH_PLAYBOOK);
    const stepCount = OUTREACH_PLAYBOOK.sections.flatMap((s) => s.lessons).reduce((n, l) => n + (l.steps?.length ?? 0), 0);
    expect(targets).toHaveLength(stepCount);
    expect(new Set(targets.map((t) => t.stepKey)).size).toBe(stepCount);
    expect(targets[0].stepKey).toBe(stepKey(OUTREACH_PLAYBOOK.slug, targets[0].lessonId, 0));
  });
  it("carries the learning id for steps that name a control", () => {
    const withId = buildCaptureTargets(OUTREACH_PLAYBOOK).filter((t) => t.learningId);
    expect(withId.map((t) => t.learningId)).toEqual(["outreach-manual", "outreach-automated"]);
  });
  it("syncRow touches metadata only, never capture or approval columns", () => {
    const keys = Object.keys(syncRow(buildCaptureTargets(OUTREACH_PLAYBOOK)[0]));
    for (const k of ["image_path", "content_hash", "approved_image_path", "approved_at", "needs_fix", "capture_error"]) {
      expect(keys).not.toContain(k);
    }
  });
});

describe("status", () => {
  it("is missing before any capture", () => expect(screenshotStatus(row())).toBe("missing"));
  it("is captured once an image exists", () => {
    expect(screenshotStatus(row({ image_path: "p", content_hash: "h" }))).toBe("captured");
  });
  it("is stale when the screen changed since approval", () => {
    expect(screenshotStatus(row({ image_path: "p2", content_hash: "h2", approved_image_path: "p1", approved_hash: "h1" }))).toBe("stale");
  });
  it("is needs a fix after a failed capture or a staff flag", () => {
    expect(screenshotStatus(row({ image_path: "p", capture_error: "Control not found" }))).toBe("needs_fix");
    expect(screenshotStatus(row({ image_path: "p", needs_fix: true }))).toBe("needs_fix");
  });
  it("counts each status", () => {
    const n = countByStatus([row(), row({ image_path: "p", content_hash: "h" }), row({ needs_fix: true })]);
    expect(n).toEqual({ captured: 1, stale: 0, missing: 1, needs_fix: 1 });
  });
});

describe("what founders see", () => {
  const approved = { image_path: "p1", content_hash: "h1", approved_image_path: "p1", approved_hash: "h1" };
  it("shows an approved image of an unchanged screen", () => expect(founderVisible(row(approved))).toBe(true));
  it("shows nothing before approval", () => expect(founderVisible(row({ image_path: "p1", content_hash: "h1" }))).toBe(false));
  it("hides the image when the screen changed", () => expect(founderVisible(row({ ...approved, image_path: "p2", content_hash: "h2" }))).toBe(false));
  it("hides the image when a capture failed or staff flagged it", () => {
    expect(founderVisible(row({ ...approved, capture_error: "Page returned 404." }))).toBe(false);
    expect(founderVisible(row({ ...approved, needs_fix: true }))).toBe(false);
  });
});

describe("approval", () => {
  it("publishes the latest capture and clears any flag", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const patch = approvalPatch(row({ image_path: "p2", content_hash: "h2", captured_at: "2026-10-18T10:00:00Z", app_version: "abc" }), "u1", now);
    expect(patch).toMatchObject({ approved_image_path: "p2", approved_hash: "h2", approved_by: "u1", approved_app_version: "abc", needs_fix: false });
    expect(patch?.approved_at).toBe(now.toISOString());
  });
  it("refuses when there is no image or the last capture failed", () => {
    expect(approvalPatch(row(), "u1", new Date())).toBeNull();
    expect(approvalPatch(row({ image_path: "p", capture_error: "boom" }), "u1", new Date())).toBeNull();
  });
  it("awaits approval until the approved image matches the latest one", () => {
    expect(awaitingApproval(row({ image_path: "p" }))).toBe(true);
    expect(awaitingApproval(row({ image_path: "p", approved_image_path: "p" }))).toBe(false);
    expect(awaitingApproval(row({ image_path: "p", needs_fix: true }))).toBe(false);
  });
  it("filters by status and by awaiting approval", () => {
    const rows = [row({ step_key: "a" }), row({ step_key: "b", image_path: "p", content_hash: "h" })];
    expect(filterScreenshots(rows, "missing").map((r) => r.step_key)).toEqual(["a"]);
    expect(filterScreenshots(rows, "awaiting").map((r) => r.step_key)).toEqual(["b"]);
    expect(filterScreenshots(rows, "all")).toHaveLength(2);
  });
});
