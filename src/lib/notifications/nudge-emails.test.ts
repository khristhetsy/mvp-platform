import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification: vi.fn(), hasRecentNotification: vi.fn() }));

import { stageNudgeEmail } from "./founder-nudges";
import { GATE_DEFS, gateEmailPreview } from "./stage-gate-reminders";

describe("stageNudgeEmail", () => {
  it("renders each stage on the founder layout", () => {
    for (const stage of ["qualify", "deploy", "optimize"]) {
      const m = stageNudgeEmail("Maya", stage)!;
      expect(m.html).toContain("height:3px;background:#1A6CE4");
      expect(m.html).toContain("Hi Maya,");
      expect(m.text).toContain("Pick up where you left off: ");
      expect(m.html).not.toContain("&lt;b&gt;");
    }
  });

  it("returns null for a stage without a nudge", () => {
    expect(stageNudgeEmail("Maya", "initialize")).toBeNull();
  });

  it("drops the greeting when there is no name", () => {
    expect(stageNudgeEmail(null, "qualify")!.html).not.toContain("Hi ,");
  });
});

describe("stage gate email", () => {
  it("keeps the subject and lists the gate steps", () => {
    const gate = GATE_DEFS[0];
    const p = gateEmailPreview(gate.key, "Maya")!;
    expect(p.subject).toBe(`Reminder: ${gate.label.toLowerCase()}`);
    for (const step of gate.steps) expect(p.text).toContain(`[ ] ${step}`);
    expect(p.text).toContain("It stops automatically once it's done.");
  });
});
