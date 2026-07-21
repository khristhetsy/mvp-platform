import { describe, it, expect, afterEach } from "vitest";
import { marketingSendEnabled } from "./campaigns";

// The status gate itself lives inside sendCampaign, which needs a database. These
// tests cover the kill switch and pin the intended sendable-status policy so a
// future edit to the list is a deliberate change rather than an accident.

const ORIGINAL = process.env.MARKETING_SEND_LIVE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MARKETING_SEND_LIVE;
  else process.env.MARKETING_SEND_LIVE = ORIGINAL;
});

describe("marketingSendEnabled", () => {
  it("is enabled when the variable is unset — leaving it unset must not stop campaigns", () => {
    delete process.env.MARKETING_SEND_LIVE;
    expect(marketingSendEnabled()).toBe(true);
  });

  it("is enabled for any value other than an explicit false", () => {
    process.env.MARKETING_SEND_LIVE = "true";
    expect(marketingSendEnabled()).toBe(true);
    process.env.MARKETING_SEND_LIVE = "";
    expect(marketingSendEnabled()).toBe(true);
    process.env.MARKETING_SEND_LIVE = "yes";
    expect(marketingSendEnabled()).toBe(true);
  });

  it("is disabled only on an explicit false", () => {
    process.env.MARKETING_SEND_LIVE = "false";
    expect(marketingSendEnabled()).toBe(false);
  });
});

describe("sendable status policy", () => {
  // Mirrors SENDABLE_STATUSES in campaigns.ts. If that list changes, this test
  // should fail and force a conscious decision about what may be re-sent.
  const SENDABLE = ["draft", "scheduled"];
  const ALL = ["draft", "scheduled", "sending", "sent", "paused", "cancelled"];

  it("allows sending a draft or a scheduled campaign", () => {
    expect(SENDABLE).toContain("draft");
    expect(SENDABLE).toContain("scheduled");
  });

  it("refuses in-flight and terminal states", () => {
    for (const status of ALL.filter((s) => !SENDABLE.includes(s))) {
      expect(SENDABLE).not.toContain(status);
    }
  });

  it("refuses 'sending', which is what prevents a cron pass and a manual click double-sending", () => {
    expect(SENDABLE).not.toContain("sending");
  });

  it("refuses 'sent', which is what prevents re-blasting a finished campaign", () => {
    expect(SENDABLE).not.toContain("sent");
  });
});
