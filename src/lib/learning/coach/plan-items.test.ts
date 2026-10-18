import { describe, expect, it } from "vitest";
import { calendarBody, pacificDate, taskBody } from "./plan-items";

describe("coach plan items", () => {
  it("uses the Pacific date, not the UTC date, for the task due date", () => {
    // 2026-10-27 02:00 UTC is still Oct 26 evening in Pacific time.
    expect(pacificDate("2026-10-27T02:00:00.000Z")).toBe("2026-10-26");
    expect(pacificDate("2026-10-27T17:00:00.000Z")).toBe("2026-10-27");
  });

  it("builds a task the Tasks route accepts", () => {
    expect(taskBody({ stepTitle: "Tag introducers", dueAt: "2026-10-27T16:00:00.000Z" })).toEqual({
      title: "AI IR Coach: Tag introducers",
      description: "Added from your AI IR Coach commitment.",
      priority: "medium",
      due_date: "2026-10-27",
      context_type: "personal",
      task_type: "investor_outreach",
    });
  });

  it("builds a 30 minute local event with no attendees and no Meet link", () => {
    const body = calendarBody({ stepTitle: "Tag introducers", dueAt: "2026-10-27T16:00:00.000Z" });
    expect(body.startTime).toBe("2026-10-27T16:00:00.000Z");
    expect(body.endTime).toBe("2026-10-27T16:30:00.000Z");
    expect(body.title).toBe("AI IR Coach: Tag introducers");
    expect(body).not.toHaveProperty("attendees");
    expect(body).not.toHaveProperty("addMeet");
  });

  it("caps very long titles to what the routes allow", () => {
    expect(taskBody({ stepTitle: "x".repeat(900), dueAt: "2026-10-27T16:00:00.000Z" }).title).toHaveLength(500);
    expect(calendarBody({ stepTitle: "x".repeat(900), dueAt: "2026-10-27T16:00:00.000Z" }).title).toHaveLength(300);
  });
});
