import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createMockSupabaseClient, readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);

describe("requireApiProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns supabase and profile when session and profile are valid", async () => {
    const supabase = createMockSupabaseClient({
      getUser: { data: { user: { id: "user-1" } }, error: null },
      profile: {
        data: { id: "user-1", role: "founder", email: "founder@example.com" },
        error: null,
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(supabase as never);

    const result = await requireApiProfile();

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.profile.id).toBe("user-1");
      expect(result.profile.role).toBe("founder");
    }
  });

  it("allows access when role is in allowedRoles", async () => {
    const supabase = createMockSupabaseClient({
      getUser: { data: { user: { id: "admin-1" } }, error: null },
      profile: {
        data: { id: "admin-1", role: "admin", email: "admin@example.com" },
        error: null,
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(supabase as never);

    const result = await requireApiProfile(["admin", "analyst"]);

    expect("error" in result).toBe(false);
  });

  it("returns 401 when there is no authenticated user", async () => {
    const supabase = createMockSupabaseClient({
      getUser: { data: { user: null }, error: { message: "no session" } },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(supabase as never);

    const result = await requireApiProfile(["admin"]);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBeInstanceOf(NextResponse);
      expect(result.error!.status).toBe(401);
      const body = await readJsonResponse(result.error!);
      expect(body.error).toBe("Authentication required.");
    }
  });

  it("returns 403 when profile is missing", async () => {
    const supabase = createMockSupabaseClient({
      getUser: { data: { user: { id: "user-1" } }, error: null },
      profile: { data: null, error: { message: "not found" } },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(supabase as never);

    const result = await requireApiProfile();

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error!.status).toBe(403);
      const body = await readJsonResponse(result.error!);
      expect(body.error).toBe("Profile not found.");
    }
  });

  it("returns 403 when role is not permitted", async () => {
    const supabase = createMockSupabaseClient({
      getUser: { data: { user: { id: "founder-1" } }, error: null },
      profile: {
        data: { id: "founder-1", role: "founder", email: "founder@example.com" },
        error: null,
      },
    });
    mockCreateServerSupabaseClient.mockResolvedValue(supabase as never);

    const result = await requireApiProfile(["admin", "analyst"]);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error!.status).toBe(403);
      const body = await readJsonResponse(result.error!);
      expect(body.error).toBe("Insufficient permissions.");
    }
  });
});
