import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { defaultConfig } from "./weekly-email";
import { validateWeekly, type WeeklySaveInput } from "./weekly-store";

const schedule: WeeklySaveInput["schedule"] = { enabled: false, start_date: "2026-11-09", end_date: null, repeat: "weekly", weekdays: [1], send_time: "05:00", max_per_run: 5000, reminder_minutes: 1440, unreviewed_action: "send" };
const input = (over: Partial<ReturnType<typeof defaultConfig>>): WeeklySaveInput => ({ config: { ...defaultConfig("founder"), ...over }, schedule });

describe("validateWeekly", () => {
  it("accepts the defaults", () => {
    expect(validateWeekly(input({}))).toBeNull();
  });
  it("needs a banner address when the banner header is chosen", () => {
    expect(validateWeekly(input({ headerMode: "banner", bannerUrl: null }))).toMatch(/banner/i);
    expect(validateWeekly(input({ headerMode: "banner", bannerUrl: "javascript:alert(1)" }))).toMatch(/banner/i);
    expect(validateWeekly(input({ headerMode: "banner", bannerUrl: "https://icapos.com/email-banner.jpg" }))).toBeNull();
  });
  it("keeps the sign off name short", () => {
    expect(validateWeekly(input({ signOff: "iCFO Capital" }))).toBeNull();
    expect(validateWeekly(input({ signOff: "x".repeat(81) }))).toMatch(/sign off/i);
  });
  it("needs recipients and a subject", () => {
    expect(validateWeekly(input({ groups: [], listIds: [] }))).toMatch(/who to send to/i);
    expect(validateWeekly(input({ subject: " " }))).toMatch(/subject/i);
  });
});
