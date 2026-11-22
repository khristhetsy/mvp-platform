import { describe, it, expect, vi, beforeEach } from "vitest";

const result = vi.hoisted(() => ({ value: { data: null, error: null } as { data: unknown; error: { message: string } | null } }));

vi.mock("@/lib/supabase/admin", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve(result.value);
  return { serviceRoleClientUntyped: () => chain };
});

import { getPublishedBySlug } from "./store";

describe("getPublishedBySlug", () => {
  beforeEach(() => {
    result.value = { data: null, error: null };
  });

  it("returns null when no published page has that slug", async () => {
    await expect(getPublishedBySlug("missing")).resolves.toBeNull();
  });

  it("throws on a database error instead of reporting not found", async () => {
    result.value = { data: null, error: { message: "connection reset" } };
    await expect(getPublishedBySlug("capital-readiness-rating")).rejects.toThrow(/connection reset/);
  });
});
