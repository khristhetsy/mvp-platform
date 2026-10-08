import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crr/crr-for", () => ({ crrFor: vi.fn() }));
vi.mock("@/lib/crr/weight-sets-db", () => ({ loadActiveSet: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));

import { outreachDiagnosis } from "@/lib/admin/stage-diagnosis";
import type { AdminOutreachSummary } from "@/lib/admin/company-workspace-types";

const cleared = { unlocked: true, short: 0, score: 89, gate: 65 };

function status(over: Partial<AdminOutreachSummary> = {}): AdminOutreachSummary {
  return {
    automated: { state: "running", sent: 19, launched: true },
    manual: { sent: 0, started: false },
    complete: false,
    manualReminder: null,
    ...over,
  };
}

describe("Outreach drawer covers automated and manual", () => {
  it("automated running, manual not started: 1 of 2 and blocking", () => {
    const d = outreachDiagnosis(status(), cleared);
    expect(d.headline).toBe("Automated running, 19 sent · Manual not started · 1 of 2");
    expect(d.problem[0]).toMatch(/No manual email has gone out/);
    expect(d.missing.map((m) => m.note)).toEqual(["19 sent", "0 sent"]);
    expect(d.fixes[0].who).toBe("Founder · Outreach › Manual");
  });

  it("both modes used: complete and not blocking", () => {
    const d = outreachDiagnosis(
      status({ manual: { sent: 4, started: true, opened: 2, replied: 1 }, complete: true }),
      cleared,
    );
    expect(d.headline).toBe("Automated running, 19 sent · Manual 4 sent, 2 opened, 1 replied");
    expect(d.problem[0]).toMatch(/not blocking/);
  });

  it("CRR below the gate: automated held, manual still open", () => {
    const d = outreachDiagnosis(
      status({ automated: { state: "not_started", sent: 0, launched: false } }),
      { unlocked: false, short: 12, score: 53, gate: 65 },
    );
    expect(d.headline).toBe("Automated held, 12 points to the gate · Manual not started · 0 of 2");
    expect(d.problem.join(" ")).toMatch(/manual goes to the founder's own contacts and can start now/);
  });

  it("shows the reminder cadence dates in PT", () => {
    const d = outreachDiagnosis(
      status({ manualReminder: { sendsCount: 2, lastSentAt: "2026-10-08T03:00:00Z", nextSendAt: "2026-10-15T03:00:00Z", resolvedAt: null, paused: false } }),
      cleared,
    );
    expect(d.fixes[1].text).toMatch(/last Oct 7 PT, next Oct 14 PT/);
  });
});
