import { describe, it, expect, beforeEach } from "vitest";
import { violatesGuardrails } from "./guardrails";
import { checkRateLimit, __resetRateLimit } from "./ratelimit";

describe("AI output guardrails (spec §7.3)", () => {
  it("flags guarantee / 'you will raise' patterns", () => {
    expect(violatesGuardrails("We guarantee you'll get funded.")).toBe(true);
    expect(violatesGuardrails("With us you will raise your round.")).toBe(true);
    expect(violatesGuardrails("Expect a promised return on your raise.")).toBe(true);
    expect(violatesGuardrails("This lifts your funding probability materially.")).toBe(true);
  });

  it("flags a percentage adjacent to a performance noun", () => {
    expect(violatesGuardrails("You're 40% more likely to raise with iCapOS.")).toBe(true);
    expect(violatesGuardrails("Expect a 20% valuation lift.")).toBe(true);
  });

  it("allows the approved directionally-modeled figures", () => {
    expect(violatesGuardrails("Cold pipelines close at roughly 0.5–2% end to end.")).toBe(false);
    expect(violatesGuardrails("Founders see 30–50% faster diligence cycles.")).toBe(false);
    expect(violatesGuardrails("Around 50–70% less wasted outreach.")).toBe(false);
  });

  it("allows an honest refusal", () => {
    expect(violatesGuardrails("No one can promise a funding outcome, and I won't either.")).toBe(false);
  });
});

describe("AI rate limiting (spec §7.2)", () => {
  beforeEach(() => __resetRateLimit());

  it("allows up to 20 calls per IP per hour, then blocks", () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 20; i++) expect(checkRateLimit({ ip }).ok).toBe(true);
    const blocked = checkRateLimit({ ip });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toBe("rate");
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("limits per session to 40 calls", () => {
    // Spread across IPs so the per-IP cap doesn't trip first.
    for (let i = 0; i < 40; i++) {
      expect(checkRateLimit({ ip: `10.0.0.${i}`, sessionId: "sess-1" }).ok).toBe(true);
    }
    expect(checkRateLimit({ ip: "10.0.1.1", sessionId: "sess-1" }).ok).toBe(false);
  });
});
