import { describe, expect, it } from "vitest";
import { automationToReminder } from "./automation";

describe("automationToReminder", () => {
  it("opens the opportunity and names the target stage", () => {
    const r = automationToReminder({ id: "a1", created_at: "2026-11-14T10:00:00Z", to: { name: "Meeting" }, opportunity: { id: "o1", title: "Ann Lee", owner_id: null } });
    expect(r).toMatchObject({ id: "automation:a1", title: "Move Ann Lee to Meeting?", href: "/admin/sales/opportunities/o1", done_at: null });
  });
  it("skips a suggestion whose opportunity is gone", () => {
    expect(automationToReminder({ id: "a2", created_at: "2026-11-14T10:00:00Z", opportunity: null })).toBeNull();
  });
});
