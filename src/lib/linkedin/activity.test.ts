import { describe, expect, it } from "vitest";
import { activityAction, activityCsv, activityLabel, activityReason, activityStatus, linkedInProfileUrl, toActivityRow, type ActivityRow } from "./activity";

describe("activityStatus", () => {
  it("maps each event kind to its status", () => {
    expect(activityStatus("invite_sent", null)).toBe("sent");
    expect(activityStatus("failed", "No Connect button")).toBe("failed");
    expect(activityStatus("accepted", null)).toBe("accepted");
    expect(activityStatus("reply", null)).toBe("replied");
    expect(activityStatus("warning", "x")).toBe("warning");
  });
  it("tells a dry run and an already connected person apart from a plain queued event", () => {
    expect(activityStatus("queued", "Dry run: invite was filled in, not sent")).toBe("dry_run");
    expect(activityStatus("queued", "Already connected, moved to message")).toBe("already_connected");
    expect(activityStatus("queued", null)).toBe("queued");
  });
});

describe("activity text", () => {
  it("labels messages and invites", () => {
    expect(activityAction("reply")).toBe("Message");
    expect(activityAction("message_sent")).toBe("Message");
    expect(activityAction("invite_sent")).toBe("Invite");
    expect(activityAction("failed")).toBe("Invite");
    expect(activityLabel("dry_run")).toBe("Dry run");
  });
  it("drops the dry run prefix from the reason", () => {
    expect(activityReason("dry_run", "Dry run: invite was filled in, not sent")).toBe("Invite was filled in, not sent");
    expect(activityReason("failed", " Could not find a Connect button ")).toBe("Could not find a Connect button");
    expect(activityReason("sent", null)).toBe("");
  });
});

describe("linkedInProfileUrl", () => {
  it("builds a profile link from a clean slug", () => {
    expect(linkedInProfileUrl("tim-wilson-9ab6")).toBe("https://www.linkedin.com/in/tim-wilson-9ab6/");
    expect(linkedInProfileUrl("ana%C3%A9")).toBe("https://www.linkedin.com/in/ana%C3%A9/");
  });
  it("returns null for empty or unsafe slugs", () => {
    expect(linkedInProfileUrl(null)).toBeNull();
    expect(linkedInProfileUrl("  ")).toBeNull();
    expect(linkedInProfileUrl("a/b")).toBeNull();
    expect(linkedInProfileUrl("a b")).toBeNull();
    expect(linkedInProfileUrl("javascript:alert(1)//x")).toBeNull();
    expect(linkedInProfileUrl("%E0%A4%A")).toBeNull();
  });
});

describe("toActivityRow", () => {
  it("builds a row with links and joined names", () => {
    const row = toActivityRow({
      id: "e1", kind: "failed", detail: "No Connect button", created_at: "2026-11-09T13:26:25Z",
      linkedin_targets: { display_name: "Melisa Kaya", linkedin_slug: "melisa-kaya-b41b4a210", contact_id: "c1" },
      linkedin_campaigns: { name: "Seed capital" }, linkedin_accounts: { label: "Khris Thetsy", linkedin_slug: null },
    });
    expect(row).toMatchObject({ person: "Melisa Kaya", personUrl: "https://www.linkedin.com/in/melisa-kaya-b41b4a210/", contactId: "c1", account: "Khris Thetsy", accountUrl: null, campaign: "Seed capital", action: "Invite", status: "failed", reason: "No Connect button" });
  });
  it("copes with missing joins", () => {
    const row = toActivityRow({ id: "e2", kind: "invite_sent", detail: null, created_at: "2026-11-09T13:26:25Z", linkedin_targets: null, linkedin_campaigns: null, linkedin_accounts: null });
    expect(row).toMatchObject({ person: "Unknown", personUrl: null, account: "", campaign: null, status: "sent" });
  });
});

describe("activityCsv", () => {
  const base: ActivityRow = { id: "1", at: "2026-11-09T13:26:00Z", person: "Ana, \"A\" Ruiz", personUrl: null, contactId: null, account: "Khris Thetsy", accountUrl: null, campaign: "Seed", action: "Invite", status: "failed", reason: "=HYPERLINK(\"x\")" };
  it("writes a header, quotes cells and neutralises formulas", () => {
    const csv = activityCsv([base], "Europe/Paris");
    const [head, line] = csv.split("\n");
    expect(head).toBe("When,Person,LinkedIn profile,Account,Campaign,Action,Status,Reason");
    expect(line).toContain("\"Ana, \"\"A\"\" Ruiz\"");
    expect(line).toContain("'=HYPERLINK");
    expect(line).toContain("2026-11-09 14:26");
  });
});
