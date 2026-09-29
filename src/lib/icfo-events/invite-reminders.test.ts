import { describe, it, expect } from "vitest";
import { daysUntil, shouldRemind, REMINDER_DAYS } from "@/lib/icfo-events/invite-reminders";

const NOW = new Date("2026-09-15T12:00:00Z");
const due = (days: number) => {
  const d = new Date(Date.UTC(2026, 8, 15) + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

describe("counting days to the due date", () => {
  it("is 0 on the day itself, whatever the time", () => {
    expect(daysUntil(due(0), NOW)).toBe(0);
    expect(daysUntil(due(0), new Date("2026-09-15T23:59:00Z"))).toBe(0);
  });

  it("goes negative once overdue", () => {
    expect(daysUntil(due(-3), NOW)).toBe(-3);
  });
});

describe("two sends, then silence", () => {
  it("sends at each reminder window", () => {
    for (const d of REMINDER_DAYS) {
      expect(shouldRemind({ materialsDue: due(d), lastRemindedAt: null }, NOW), `${d} days`).toBe(true);
    }
  });

  it("stays quiet between the windows", () => {
    for (const d of [10, 5, 3, 1]) {
      expect(shouldRemind({ materialsDue: due(d), lastRemindedAt: null }, NOW), `${d} days`).toBe(false);
    }
  });

  it("stays quiet once the date has passed — nagging afterwards teaches people to ignore it", () => {
    expect(shouldRemind({ materialsDue: due(-1), lastRemindedAt: null }, NOW)).toBe(false);
  });

  it("sends nothing when no date was set", () => {
    expect(shouldRemind({ materialsDue: null, lastRemindedAt: null }, NOW)).toBe(false);
  });
});

describe("one send per window", () => {
  it("does not send twice on the same day", () => {
    const already = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(shouldRemind({ materialsDue: due(7), lastRemindedAt: already }, NOW)).toBe(false);
  });

  it("allows the second window after the first has passed", () => {
    // Reminded at the 7-day mark; now at the 2-day mark, five days later.
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldRemind({ materialsDue: due(2), lastRemindedAt: fiveDaysAgo }, NOW)).toBe(true);
  });
});
