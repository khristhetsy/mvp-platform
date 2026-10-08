import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification: vi.fn() }));

import { manualOutreachTouch } from "@/lib/notifications/manual-outreach-reminders";
import { automatedStatusLine, manualStatusLine, EMPTY_OUTREACH_STATUS, type OutreachStatus } from "@/lib/founder/outreach-status-lines";

describe("manual outreach reminder cadence", () => {
  it("day 0 is a bell only, next in 3 days", () => {
    expect(manualOutreachTouch(0)).toEqual({ bell: true, email: false, aiTip: false, nextInDays: 3 });
  });
  it("day 3 is bell and email, next on day 7", () => {
    expect(manualOutreachTouch(1)).toEqual({ bell: true, email: true, aiTip: false, nextInDays: 4 });
  });
  it("day 7 is email plus the AI tip", () => {
    expect(manualOutreachTouch(2)).toEqual({ bell: false, email: true, aiTip: true, nextInDays: 7 });
  });
  it("then weekly email", () => {
    expect(manualOutreachTouch(3)).toEqual({ bell: false, email: true, aiTip: false, nextInDays: 7 });
    expect(manualOutreachTouch(12).nextInDays).toBe(7);
  });
});

describe("outreach dropdown status lines", () => {
  const running: OutreachStatus = {
    automated: { state: "running", sent: 12, launched: true },
    manual: { sent: 0, started: false },
    complete: false,
  };
  it("shows running count for automated", () => {
    expect(automatedStatusLine(running)).toBe("Running, 12 sent");
  });
  it("adds the Stage 3 note to a manual mode that hasn't started", () => {
    expect(manualStatusLine(running, { requiredNote: true })).toBe("Not started, needed to complete Stage 3");
  });
  it("drops the note once the first manual email is sent", () => {
    const s = { ...running, manual: { sent: 3, started: true }, complete: true };
    expect(manualStatusLine(s, { requiredNote: true })).toBe("3 sent");
  });
  it("notes automated too when a founder hasn't launched it", () => {
    expect(automatedStatusLine(EMPTY_OUTREACH_STATUS, { requiredNote: true })).toBe("Not started, needed to complete Stage 3");
  });
});
