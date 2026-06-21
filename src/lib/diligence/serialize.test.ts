import { describe, it, expect } from "vitest";
import { applyRoleFilter, type ReportPayload } from "./serialize";
import type { GateMap } from "./gate";

function payload(): ReportPayload {
  return {
    engagement: { id: "e1", company_name: "Acme", posture: "Proceed", recommendation: "Invest", owner_id: "u1", confidence_pct: 70 },
    domains: [{ code: "D-01" }],
    findings: [{ id: "f1", title: "Risk", internal_note: "secret candor", severity: "high" }],
    claims: [{ id: "c1", claim: "ARR $1M", verification: "verified" }],
    responses: [{ id: "r1", body: "We disagree", icfo_review: "needs_more", disposition: "dispute" }],
    docRequests: [{ id: "dr1", label: "Cap table" }],
    conditions: [{ id: "cd1", label: "Sign SAFE" }],
    confidence: 70,
  };
}

const openGate: GateMap = {
  findings: { founder_visible: true, investor_visible: true },
  responses: { founder_visible: true, investor_visible: true },
  data_room: { founder_visible: true, investor_visible: false },
  candor: { founder_visible: false, investor_visible: false },
  icfo_review: { founder_visible: false, investor_visible: false },
  verdict: { founder_visible: false, investor_visible: true },
};

describe("applyRoleFilter", () => {
  it("passes everything through for admin", () => {
    const out = applyRoleFilter(payload(), "admin", {});
    expect(out.claims).toHaveLength(1);
    expect((out.findings[0] as Record<string, unknown>).internal_note).toBe("secret candor");
    expect((out.engagement as Record<string, unknown>).posture).toBe("Proceed");
  });

  it("drops claims entirely for non-admins", () => {
    expect(applyRoleFilter(payload(), "founder", openGate).claims).toBeUndefined();
    expect(applyRoleFilter(payload(), "investor", openGate).claims).toBeUndefined();
  });

  it("strips candor (internal_note) from founder findings", () => {
    const out = applyRoleFilter(payload(), "founder", openGate);
    expect(out.findings).toHaveLength(1);
    expect((out.findings[0] as Record<string, unknown>).internal_note).toBeUndefined();
  });

  it("strips icfo_review from founder responses", () => {
    const out = applyRoleFilter(payload(), "founder", openGate);
    expect((out.responses[0] as Record<string, unknown>).icfo_review).toBeUndefined();
  });

  it("hides sections whose gate is off", () => {
    const closed: GateMap = { ...openGate, findings: { founder_visible: false, investor_visible: false } };
    const out = applyRoleFilter(payload(), "founder", closed);
    expect(out.findings).toHaveLength(0);
    expect(out.conditions).toHaveLength(0); // conditions follow the findings gate
  });

  it("shows verdict only when the verdict gate is on", () => {
    const founder = applyRoleFilter(payload(), "founder", openGate); // verdict off for founder
    expect((founder.engagement as Record<string, unknown>).posture).toBeNull();
    const investor = applyRoleFilter(payload(), "investor", openGate); // verdict on for investor
    expect((investor.engagement as Record<string, unknown>).posture).toBe("Proceed");
  });

  it("never leaks owner_id to non-admins", () => {
    expect((applyRoleFilter(payload(), "investor", openGate).engagement as Record<string, unknown>).owner_id).toBeUndefined();
  });

  it("withholds the data room from investors (gate off) but gives it to founders", () => {
    expect(applyRoleFilter(payload(), "investor", openGate).docRequests).toHaveLength(0);
    expect(applyRoleFilter(payload(), "founder", openGate).docRequests).toHaveLength(1);
  });
});
