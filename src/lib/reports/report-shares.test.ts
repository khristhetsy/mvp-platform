import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { isPlausibleShareToken, newShareToken, summarizeShares, type ShareRow } from "@/lib/reports/report-shares";

const share = (id: string): ShareRow => ({ id, token: `tok_${id}_xxxxxxxxxxxxxxxxxxxx`, label: null, revoked_at: null, created_at: "2026-10-01T00:00:00Z" });

describe("share link counts", () => {
  it("counts views and downloads per link and keeps the latest open", () => {
    const out = summarizeShares([share("a"), share("b")], [
      { share_id: "a", action: "view", viewed_at: "2026-10-02T10:00:00Z" },
      { share_id: "a", action: "view", viewed_at: "2026-10-05T10:00:00Z" },
      { share_id: "a", action: "download", viewed_at: "2026-10-04T10:00:00Z" },
    ]);
    expect(out[0]).toMatchObject({ id: "a", views: 2, downloads: 1, lastOpenedAt: "2026-10-05T10:00:00Z" });
    expect(out[1]).toMatchObject({ id: "b", views: 0, downloads: 0, lastOpenedAt: null });
  });

  it("keeps the share order it was given", () => {
    expect(summarizeShares([share("z"), share("a")], []).map((s) => s.id)).toEqual(["z", "a"]);
  });
});

describe("share tokens", () => {
  it("are long, url safe and different every time", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).not.toBe(b);
    expect(isPlausibleShareToken(a)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects anything that is not one of ours", () => {
    expect(isPlausibleShareToken("short")).toBe(false);
    expect(isPlausibleShareToken("../../etc/passwd/aaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});
