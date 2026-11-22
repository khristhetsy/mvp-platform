import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const optOutByNumber = vi.fn();
const handleInboundReply = vi.fn();
vi.mock("@/lib/voice/messaging", () => ({ optOutByNumber: (...a: unknown[]) => optOutByNumber(...a) }));
vi.mock("@/lib/voice/inbound-replies", () => ({ handleInboundReply: (...a: unknown[]) => handleInboundReply(...a) }));

import { POST } from "./route";

function request(query: string, body: Record<string, string>): NextRequest {
  const form = new URLSearchParams(body);
  return new NextRequest(`http://localhost/api/voice/sms-inbound${query}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

describe("POST /api/voice/sms-inbound", () => {
  const original = process.env.VOICE_AGENT_SECRET;
  beforeEach(() => {
    optOutByNumber.mockReset();
    handleInboundReply.mockReset();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.VOICE_AGENT_SECRET;
    else process.env.VOICE_AGENT_SECRET = original;
  });

  it("refuses every request when no secret is configured", async () => {
    delete process.env.VOICE_AGENT_SECRET;
    const res = await POST(request("", { From: "+15550001111", Body: "STOP" }));
    expect(res.status).toBe(401);
    expect(optOutByNumber).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    process.env.VOICE_AGENT_SECRET = "right";
    const res = await POST(request("?s=wrong", { From: "+15550001111", Body: "STOP" }));
    expect(res.status).toBe(401);
    expect(optOutByNumber).not.toHaveBeenCalled();
  });

  it("records a STOP when the secret matches", async () => {
    process.env.VOICE_AGENT_SECRET = "right";
    const res = await POST(request("?s=right", { From: "+15550001111", Body: "STOP" }));
    expect(res.status).toBe(200);
    expect(optOutByNumber).toHaveBeenCalledWith("+15550001111");
  });
});
