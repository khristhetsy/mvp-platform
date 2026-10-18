import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crr/crr-for", () => ({ crrFor: vi.fn() }));
vi.mock("@/lib/outreach/manual-outreach", () => ({ getManualOutreach: vi.fn(), getManualRecipients: vi.fn() }));
vi.mock("@/lib/calendar/events", () => ({ listEvents: vi.fn() }));

import { crrFor } from "@/lib/crr/crr-for";
import { getManualOutreach, getManualRecipients } from "@/lib/outreach/manual-outreach";
import { listEvents } from "@/lib/calendar/events";
import { loadCoachSnapshot } from "./snapshot-loader";
import { OUTREACH_PLAYBOOK } from "@/lib/learning/outreach-playbook";

const db = (rows: unknown[] | null) =>
  ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) q[m] = () => q;
      q.limit = () => Promise.resolve(rows === null ? { data: null, error: { message: "boom" } } : { data: rows, error: null });
      return q;
    },
  }) as never;

const crrOk = {
  score: 60, isOverridden: false, gate: 65, pointsToGate: 5, outreachUnlocked: false, scoredAt: "2026-10-01T00:00:00Z",
  factorGaps: [{ key: "revenue_cashflow", label: "Revenue", pts: 2, max: 14, dimension: "Traction" }],
};

describe("loadCoachSnapshot", () => {
  it("reads all five sources", async () => {
    vi.mocked(crrFor).mockResolvedValue(crrOk as never);
    vi.mocked(getManualOutreach).mockResolvedValue(null);
    vi.mocked(getManualRecipients).mockResolvedValue([]);
    vi.mocked(listEvents).mockResolvedValue([]);
    const snap = await loadCoachSnapshot({ supabase: db([]), founderId: "f", companyId: "c", course: OUTREACH_PLAYBOOK });
    expect(snap.sources.map((s) => s.key)).toEqual(["rating", "fix_list", "manual_outreach", "calendar", "course_progress"]);
    expect(snap.sources.map((s) => s.status)).toEqual(["data", "data", "empty", "empty", "empty"]);
  });

  it("marks one failing source unavailable and still reads the rest", async () => {
    vi.mocked(crrFor).mockRejectedValue(new Error("down"));
    vi.mocked(getManualOutreach).mockResolvedValue(null);
    vi.mocked(getManualRecipients).mockResolvedValue([]);
    vi.mocked(listEvents).mockRejectedValue(new Error("down"));
    const snap = await loadCoachSnapshot({ supabase: db(null), founderId: "f", companyId: "c", course: OUTREACH_PLAYBOOK });
    const status = Object.fromEntries(snap.sources.map((s) => [s.key, s.status]));
    expect(status).toEqual({ rating: "unavailable", fix_list: "unavailable", manual_outreach: "empty", calendar: "unavailable", course_progress: "unavailable" });
  });

  it("treats a founder with no company as not rated, not as an error", async () => {
    vi.mocked(crrFor).mockResolvedValue({ ...crrOk, score: null, factorGaps: [] } as never);
    vi.mocked(listEvents).mockResolvedValue([]);
    const snap = await loadCoachSnapshot({ supabase: db([]), founderId: "f", companyId: null, course: OUTREACH_PLAYBOOK });
    expect(snap.sources[0].status).toBe("empty");
    expect(snap.sources[1].status).toBe("empty");
    expect(snap.sources[2].status).toBe("empty");
  });
});
