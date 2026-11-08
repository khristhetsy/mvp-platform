import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const loadPartnerScore = vi.fn();
vi.mock("./load", () => ({ loadPartnerScore: (...args: unknown[]) => loadPartnerScore(...args) }));

import { refreshPartnerScoreSnapshots } from "./snapshot";

type Rows = Array<Record<string, unknown>>;

function fakeAdmin(opts: { investorProfileIds: string[]; profileIds: string[] | null }) {
  const upserts: Rows[] = [];
  const result = (data: unknown) => {
    const p = Promise.resolve({ data, error: null });
    return Object.assign(p, { in: () => Promise.resolve({ data, error: null }) });
  };
  const admin = {
    from(table: string) {
      if (table === "investor_profiles") {
        return { select: () => result(opts.investorProfileIds.map((profile_id) => ({ profile_id }))) };
      }
      if (table === "profiles") {
        return {
          select: () =>
            opts.profileIds === null
              ? { in: () => Promise.resolve({ data: null, error: { message: "boom" } }) }
              : result(opts.profileIds.map((id) => ({ id }))),
        };
      }
      if (table === "partner_score_snapshots") {
        return {
          select: () => result([]),
          upsert: (rows: Rows) => {
            upserts.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { admin: admin as unknown as SupabaseClient<Database>, upserts };
}

beforeEach(() => {
  loadPartnerScore.mockReset();
  loadPartnerScore.mockResolvedValue({ score: 70, tier: "gold", status: "ok", sampleSize: 3 });
});

describe("refreshPartnerScoreSnapshots", () => {
  it("skips investors whose profile no longer exists, so the upsert is not rejected", async () => {
    const { admin, upserts } = fakeAdmin({ investorProfileIds: ["a", "b", "orphan"], profileIds: ["a", "b"] });
    const out = await refreshPartnerScoreSnapshots(admin);
    expect(out).toEqual({ refreshed: 2, remaining: 0 });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].map((r) => r.investor_id).sort()).toEqual(["a", "b"]);
    expect(loadPartnerScore).not.toHaveBeenCalledWith(expect.anything(), "orphan", expect.anything(), expect.anything());
  });

  it("does nothing when every investor profile is missing", async () => {
    const { admin, upserts } = fakeAdmin({ investorProfileIds: ["x"], profileIds: [] });
    expect(await refreshPartnerScoreSnapshots(admin)).toEqual({ refreshed: 0, remaining: 0 });
    expect(upserts).toHaveLength(0);
  });

  it("keeps every id when the profile lookup fails", async () => {
    const { admin, upserts } = fakeAdmin({ investorProfileIds: ["a", "b"], profileIds: null });
    expect(await refreshPartnerScoreSnapshots(admin)).toEqual({ refreshed: 2, remaining: 0 });
    expect(upserts[0].map((r) => r.investor_id).sort()).toEqual(["a", "b"]);
  });

  it("returns early when there are no investors", async () => {
    const { admin, upserts } = fakeAdmin({ investorProfileIds: [], profileIds: [] });
    expect(await refreshPartnerScoreSnapshots(admin)).toEqual({ refreshed: 0, remaining: 0 });
    expect(upserts).toHaveLength(0);
  });
});
