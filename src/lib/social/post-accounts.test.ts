import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
import { nextSeriesVariants, seriesPostChanges } from "./post-accounts";

describe("series account picker", () => {
  it("keeps each account's own copy and starts new accounts from the first copy", () => {
    const cur = [{ accountId: "khris", body: "K copy" }, { accountId: "fb", body: "FB copy" }];
    expect(nextSeriesVariants(cur, ["khris", "michael", "khris"], "fallback")).toEqual([
      { accountId: "khris", body: "K copy" },
      { accountId: "michael", body: "K copy" },
    ]);
    expect(nextSeriesVariants([], ["a"], "fallback")).toEqual([{ accountId: "a", body: "fallback" }]);
  });
  it("adds missing accounts and removes only unpublished copies of unticked ones", () => {
    const vs = [
      { id: "v1", account_id: "khris", status: "queued" },
      { id: "v2", account_id: "fb", status: "queued" },
      { id: "v3", account_id: "jess", status: "published" },
      { id: "v4", account_id: "old", status: "publishing" },
    ];
    expect(seriesPostChanges(vs, ["khris", "michael"])).toEqual({ add: ["michael"], remove: ["v2"] });
  });
});
