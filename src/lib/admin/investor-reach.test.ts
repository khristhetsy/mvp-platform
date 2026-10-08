import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
import { logsFor, pickNearest, NON_INTRO_SOURCES } from "@/lib/admin/investor-reach";

const log = (id: number, to: string, source: string, at: string, extra: Record<string, string | null> = {}) => ({
  id, to_email: to, source, created_at: at, status: "sent", delivered_at: null, opened_at: null, clicked_at: null, bounced_at: null, ...extra,
});

describe("Investor reach email matching", () => {
  const logs = [
    log(1, "Ana@Lumen.com", "investor-intro", "2026-10-06T14:00:05Z", { opened_at: "2026-10-06T16:20:00Z" }),
    log(2, "ana@lumen.com", "investor-intro", "2026-10-01T14:00:00Z"),
    log(3, "ana@lumen.com", "marketing-campaign", "2026-10-06T14:00:01Z"),
    log(4, "ana@lumen.com", "gmail", "2026-10-07T09:00:00Z"),
  ];

  it("finds the automated send nearest its sent_at, ignoring case and other sources", () => {
    expect(pickNearest(logs, "ana@lumen.com", "investor-intro", "2026-10-06T14:00:00Z")?.id).toBe(1);
  });

  it("returns nothing when no send is within 30 minutes (test mode)", () => {
    expect(pickNearest(logs, "ana@lumen.com", "investor-intro", "2026-10-03T14:00:00Z")).toBeNull();
  });

  it("intro emails: after the request, excluding bulk and automated sources, oldest first", () => {
    const got = logsFor(logs, "ANA@lumen.com", "2026-10-05T00:00:00Z", (l) => !NON_INTRO_SOURCES.has(l.source ?? ""));
    expect(got.map((l) => l.id)).toEqual([4]);
  });

  it("no email address means no matches", () => {
    expect(logsFor(logs, null, null, () => true)).toEqual([]);
    expect(pickNearest(logs, null, "investor-intro", "2026-10-06T14:00:00Z")).toBeNull();
  });
});
