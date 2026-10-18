import { describe, expect, it } from "vitest";
import {
  buildCoachCourseRows,
  buildCoachFounderRows,
  isCoachReady,
  planEnrollment,
  wholeDaysBetween,
  type FounderForEnrollment,
} from "./admin";
import { OUTREACH_PLAYBOOK_SLUG } from "@/lib/learning/outreach-playbook";
import { currentReviewHash } from "./review-pack";

const founder = (id: string, o: Partial<FounderForEnrollment> = {}): FounderForEnrollment => ({
  id,
  email: `${id}@example.com`,
  role: "founder",
  companyId: `c-${id}`,
  ...o,
});

describe("coach course rows", () => {
  it("marks the playbook ready and everything else not ready with a reason", () => {
    expect(isCoachReady(OUTREACH_PLAYBOOK_SLUG)).toBe(true);
    expect(isCoachReady("no-such-course")).toBe(false);
    const rows = buildCoachCourseRows([]);
    const playbook = rows.find((r) => r.key === OUTREACH_PLAYBOOK_SLUG)!;
    expect(isCoachReady(OUTREACH_PLAYBOOK_SLUG)).toBe(true);
    // Steps are ready, but counsel has not reviewed the wording, so it cannot be switched on yet.
    expect(playbook.review).toBe("not_reviewed");
    expect(playbook.ready).toBe(false);
    expect(playbook.blocker).toBe("Counsel has not reviewed this wording");
    expect(playbook.enabled).toBe(false);
    const others = rows.filter((r) => r.key !== OUTREACH_PLAYBOOK_SLUG);
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((r) => !r.ready && !r.enabled && r.blocker)).toBe(true);
  });

  it("reflects an enabled config and never shows a not ready course as on", () => {
    const rows = buildCoachCourseRows([
      { course_key: OUTREACH_PLAYBOOK_SLUG, enabled: true, tone: "driven" },
    ]);
    expect(rows.find((r) => r.key === OUTREACH_PLAYBOOK_SLUG)!.enabled).toBe(true);
  });

  it("can be switched on once counsel reviewed the current wording, and not after it changes", () => {
    const hash = currentReviewHash(OUTREACH_PLAYBOOK_SLUG)!;
    const ok = buildCoachCourseRows(
      [{ course_key: OUTREACH_PLAYBOOK_SLUG, enabled: false, tone: null, reviewed_hash: hash }],
      [{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewer_name: "Counsel A", reviewed_on: "2026-10-20" }],
    ).find((r) => r.key === OUTREACH_PLAYBOOK_SLUG)!;
    expect(ok).toMatchObject({ review: "reviewed", ready: true, blocker: null, reviewer: "Counsel A", reviewedOn: "2026-10-20" });

    const changed = buildCoachCourseRows([{ course_key: OUTREACH_PLAYBOOK_SLUG, enabled: true, tone: null, reviewed_hash: "old" }]).find((r) => r.key === OUTREACH_PLAYBOOK_SLUG)!;
    expect(changed).toMatchObject({ review: "changed", ready: false, enabled: true, blocker: "Wording changed since counsel review" });
  });
});

describe("planEnrollment", () => {
  it("enrolls selected founders including internal accounts", () => {
    const plan = planEnrollment({
      mode: "selected",
      founders: [founder("a"), founder("b", { email: "b@myicfos.com" })],
      selectedIds: ["a", "b"],
      activeFounderIds: new Set(),
    });
    expect(plan.enroll.map((e) => e.founderId)).toEqual(["a", "b"]);
  });

  it("skips internal accounts, missing companies and already active founders on all", () => {
    const plan = planEnrollment({
      mode: "all",
      founders: [
        founder("a"),
        founder("b", { email: "b@myicfos.com" }),
        founder("c", { companyId: null }),
        founder("d"),
        founder("e", { role: "investor" }),
      ],
      activeFounderIds: new Set(["d"]),
    });
    expect(plan.enroll.map((e) => e.founderId)).toEqual(["a"]);
    expect(Object.fromEntries(plan.skipped.map((s) => [s.founderId, s.reason]))).toEqual({
      b: "internal_account",
      c: "no_company",
      d: "already_active",
      e: "not_a_founder",
    });
  });

  it("ignores ids that were not selected", () => {
    const plan = planEnrollment({ mode: "selected", founders: [founder("a"), founder("b")], selectedIds: ["b"], activeFounderIds: new Set() });
    expect(plan.enroll.map((e) => e.founderId)).toEqual(["b"]);
  });
});

describe("buildCoachFounderRows", () => {
  const now = new Date("2026-10-18T20:00:00Z");
  const base = {
    founders: [
      { id: "a", full_name: "Ada", email: "a@x.com" },
      { id: "b", full_name: null, email: "b@x.com" },
    ],
    companyByFounder: new Map([["a", { id: "c-a", name: "Acme" }]]),
    now,
  };

  it("counts quiet days from the last step, or from enrollment start", () => {
    const rows = buildCoachFounderRows({
      ...base,
      enrollments: [
        { founder_id: "a", company_id: "c-a", status: "active", tone: "driven", source: "admin_selected", started_at: "2026-10-01T00:00:00Z" },
      ],
      lastStepAt: new Map([["a", "2026-10-10T00:00:00Z"]]),
    });
    expect(rows[0]).toMatchObject({ name: "Ada", company: "Acme", status: "active", quietDays: 8 });
    expect(rows[1]).toMatchObject({ name: "b@x.com", status: "off", quietDays: null, companyId: null });

    const noSteps = buildCoachFounderRows({
      ...base,
      enrollments: [{ founder_id: "a", company_id: "c-a", status: "active", tone: "driven", source: "admin_all", started_at: "2026-10-04T20:00:00Z" }],
      lastStepAt: new Map(),
    });
    expect(noSteps[0].quietDays).toBe(14);
  });

  it("gives no quiet days to paused or ended founders and prefers the active enrollment", () => {
    const rows = buildCoachFounderRows({
      ...base,
      enrollments: [
        { founder_id: "a", company_id: "c-a", status: "ended", tone: "driven", source: "admin_all", started_at: "2026-10-05T00:00:00Z" },
        { founder_id: "a", company_id: "c-old", status: "active", tone: "relentless", source: "admin_all", started_at: "2026-09-01T00:00:00Z" },
      ],
      lastStepAt: new Map(),
    });
    expect(rows[0].status).toBe("active");
    expect(rows[0].tone).toBe("relentless");
    const paused = buildCoachFounderRows({
      ...base,
      enrollments: [{ founder_id: "a", company_id: "c-a", status: "paused", tone: "driven", source: "admin_all", started_at: "2026-09-01T00:00:00Z" }],
      lastStepAt: new Map(),
    });
    expect(paused[0].quietDays).toBeNull();
  });

  it("wholeDaysBetween never goes negative", () => {
    expect(wholeDaysBetween(new Date("2026-10-19T00:00:00Z"), new Date("2026-10-18T00:00:00Z"))).toBe(0);
  });
});
