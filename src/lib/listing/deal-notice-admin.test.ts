import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { aggregateDealNotices, partnerSignUpLink, validateNewPartnerCode, type NoticeRow } from "./deal-notice-admin";

describe("aggregateDealNotices", () => {
  const notices: NoticeRow[] = [
    { company_id: "a", status: "queued", viewed_at: null, opted_in_at: null },
    { company_id: "a", status: "sent", viewed_at: "2026-10-09T01:00:00Z", opted_in_at: "2026-10-09T01:05:00Z" },
    { company_id: "a", status: "sent", viewed_at: null, opted_in_at: null },
    { company_id: "b", status: "skipped", viewed_at: null, opted_in_at: null },
    { company_id: "b", status: "failed", viewed_at: null, opted_in_at: null },
  ];
  const companies = [
    { id: "a", company_name: "Acme", listing_completed_at: "2026-10-01T00:00:00Z" },
    { id: "b", company_name: "Beta", listing_completed_at: "2026-10-05T00:00:00Z" },
    { id: "c", company_name: "Cora", listing_completed_at: "2026-10-03T00:00:00Z" },
  ];

  it("totals every status", () => {
    const { totals } = aggregateDealNotices(notices, companies);
    expect(totals).toEqual({ total: 5, queued: 1, sent: 2, skipped: 1, failed: 1, viewed: 1, optedIn: 1 });
  });

  it("lists every listed company newest first, including ones with no notices", () => {
    const { companies: rows } = aggregateDealNotices(notices, companies);
    expect(rows.map((r) => r.companyId)).toEqual(["b", "c", "a"]);
    expect(rows.find((r) => r.companyId === "c")).toMatchObject({ total: 0, queued: 0 });
    expect(rows.find((r) => r.companyId === "a")).toMatchObject({ queued: 1, sent: 2, viewed: 1, optedIn: 1, companyName: "Acme" });
  });

  it("keeps notices whose company is missing from the listed set", () => {
    const { companies: rows } = aggregateDealNotices([{ company_id: "z", status: "sent", viewed_at: null, opted_in_at: null }], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ companyId: "z", companyName: "Unknown company", sent: 1 });
  });
});

describe("validateNewPartnerCode", () => {
  it("normalizes the code to uppercase", () => {
    expect(validateNewPartnerCode({ partnerName: " AI X Network ", code: " aix2026 " })).toEqual({ ok: true, partnerName: "AI X Network", code: "AIX2026" });
  });
  it("rejects a missing name or a bad code", () => {
    expect(validateNewPartnerCode({ partnerName: "", code: "AIX" }).ok).toBe(false);
    expect(validateNewPartnerCode({ partnerName: "X", code: "ab" }).ok).toBe(false);
    expect(validateNewPartnerCode({ partnerName: "X", code: "AI-X" }).ok).toBe(false);
    expect(validateNewPartnerCode({ partnerName: "X", code: "A".repeat(21) }).ok).toBe(false);
  });
});

describe("partnerSignUpLink", () => {
  it("points to free founder sign up with the code", () => {
    expect(partnerSignUpLink("AIX")).toBe("https://icapos.com/auth/sign-up?role=founder&plan=founder_free&ref=AIX");
  });
});
