import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({}) }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUserProfile: async () => null }));
vi.mock("@/lib/icfo-events/queries", () => ({
  getEventBySlug: async () => ({ id: "e1", status: "live", title: "Demo day" }),
}));
vi.mock("@/lib/icfo-events/gamification", () => ({ getMemberStats: async () => null }));
const answer = vi.fn(async () => "Head to the Lobby.");
vi.mock("@/lib/icfo-events/assistant", () => ({
  buildEventContext: () => "ctx",
  answerEventQuestion: (...a: unknown[]) => (answer as (...x: unknown[]) => Promise<string>)(...a),
}));
const limiter = vi.fn();
vi.mock("@/lib/ai-site/ratelimit", () => ({ checkRateLimitAsync: (...a: unknown[]) => limiter(...a) }));

import { POST } from "./route";

function ask(ip = "203.0.113.7"): NextRequest {
  return new NextRequest("http://localhost/api/events/demo/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ message: "Where do I go?" }),
  });
}
const ctx = { params: Promise.resolve({ slug: "demo" }) };

describe("POST /api/events/[slug]/assistant", () => {
  beforeEach(() => {
    answer.mockClear();
    limiter.mockReset();
  });

  it("answers when the visitor is under the limit", async () => {
    limiter.mockResolvedValue({ ok: true });
    const res = await POST(ask(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe("Head to the Lobby.");
    expect(limiter).toHaveBeenCalledWith({ ip: "203.0.113.7" });
  });

  it("returns 429 and never calls the AI when the visitor is over the limit", async () => {
    limiter.mockResolvedValue({ ok: false, retryAfterSec: 120, reason: "rate" });
    const res = await POST(ask(), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(answer).not.toHaveBeenCalled();
  });
});
