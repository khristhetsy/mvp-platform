import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake platform_settings that counts reads, so the test can prove repeat checks
// within the cache window don't reach the database.
const state: { rows: Record<string, unknown>; reads: number; fail: boolean } = { rows: {}, reads: 0, fail: false };

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, key: string) => ({
          maybeSingle: async () => {
            state.reads++;
            if (state.fail) return { data: null, error: { message: "boom" } };
            return { data: key in state.rows ? { value: state.rows[key] } : null, error: null };
          },
        }),
      }),
      upsert: async (row: { key: string; value: unknown }) => {
        state.rows[row.key] = row.value;
        return { error: null };
      },
    }),
  }),
}));

import { BOOL_CACHE_MS, clearBoolSettingCache, getBoolSetting, setBoolSetting } from "@/lib/settings/platform-settings";

beforeEach(() => {
  state.rows = {};
  state.reads = 0;
  state.fail = false;
  clearBoolSettingCache();
  vi.useRealTimers();
});

describe("getBoolSetting cache", () => {
  it("reads once for repeated checks inside the window", async () => {
    state.rows.k = { enabled: true };
    for (let i = 0; i < 5; i++) expect(await getBoolSetting("k")).toBe(true);
    expect(state.reads).toBe(1);
  });

  it("caches an unset key and still returns the caller's fallback", async () => {
    expect(await getBoolSetting("missing", true)).toBe(true);
    expect(await getBoolSetting("missing", false)).toBe(false);
    expect(state.reads).toBe(1);
  });

  it("reads again after the window", async () => {
    vi.useFakeTimers();
    state.rows.k = { enabled: true };
    await getBoolSetting("k");
    state.rows.k = { enabled: false };
    vi.advanceTimersByTime(BOOL_CACHE_MS + 1);
    expect(await getBoolSetting("k")).toBe(false);
    expect(state.reads).toBe(2);
  });

  it("shows a change made on this instance at once", async () => {
    state.rows.k = { enabled: false };
    expect(await getBoolSetting("k")).toBe(false);
    await setBoolSetting("k", true, null);
    expect(await getBoolSetting("k")).toBe(true);
  });

  it("does not keep a failed read", async () => {
    state.fail = true;
    expect(await getBoolSetting("k", true)).toBe(true);
    state.fail = false;
    state.rows.k = { enabled: false };
    expect(await getBoolSetting("k", true)).toBe(false);
    expect(state.reads).toBe(2);
  });
});
