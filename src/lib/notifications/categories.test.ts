import { describe, expect, it } from "vitest";
import { notificationCategory } from "./categories";

describe("notificationCategory", () => {
  it("groups by the same colors as the emails", () => {
    expect(notificationCategory("journey_digest")).toMatchObject({ label: "Journey", color: "#0A1A40", needsAction: true });
    expect(notificationCategory("deal_room_viewed")).toMatchObject({ label: "Deal room", color: "#1A6CE4", needsAction: false });
    expect(notificationCategory("investor_expressed_interest")).toMatchObject({ label: "Match", color: "#0E7C66" });
    expect(notificationCategory("spv_target_amount_reached")).toMatchObject({ label: "SPV", color: "#0E7C66" });
    expect(notificationCategory("trial_ending_soon")).toMatchObject({ label: "Billing", color: "#B45309", needsAction: true });
    expect(notificationCategory("sms_reply")).toMatchObject({ label: "Outreach", needsAction: true });
  });

  it("marks requests as needing action and plain updates as not", () => {
    expect(notificationCategory("meeting_requested").needsAction).toBe(true);
    expect(notificationCategory("meeting_accepted").needsAction).toBe(false);
    expect(notificationCategory("deal_room_question_created").needsAction).toBe(true);
  });

  it("treats urgent severities as needing action", () => {
    expect(notificationCategory("social_alert", "warning").needsAction).toBe(true);
    expect(notificationCategory("something_new", "critical")).toMatchObject({ label: "Update", color: "#B45309", needsAction: true });
    expect(notificationCategory("something_new")).toMatchObject({ label: "Update", color: "#5A6B8C", needsAction: false });
  });
});
