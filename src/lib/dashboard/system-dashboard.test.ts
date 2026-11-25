import { describe, expect, it } from "vitest";
import { buildSystemDashboard, type SystemDashInput } from "./system-dashboard";

const now = new Date("2026-11-25T12:00:00Z");
const conn = (provider: "slack" | "webhook" | "docusign_foundation", enabled = false) => ({
  id: `c_${provider}`, provider, enabled, status: enabled ? "active" : "disabled", webhookConfigured: enabled, last_delivery_at: null, last_failure_at: null, updated_at: "2026-11-01T00:00:00Z",
});
const log = (id: string, status: string, created_at: string) => ({
  id, connection_id: "c_slack", provider: "slack", event_type: "workflow_overdue", status, attempt_count: 2, max_attempts: 4, response_code: 500,
  error_message: "secret body", next_retry_at: null, created_at, delivered_at: null,
});
const empty: SystemDashInput = {
  now,
  integrations: { connections: [conn("slack"), conn("webhook"), conn("docusign_foundation")], activeConnections: 0, failed24h: 0, pendingRetries: 0, failedQueue: [], logs: [], logsTruncated: false },
  google: { connected: false, configured: true, draftingAvailable: true, connectedAt: null },
  queues: { summary: [{ label: "Pending Company Reviews", count: 0 }], records: [] },
  automationRuns: { total: 0, records: [] },
  jobs: { total: 2, failing: 0, records: [] },
  health: { verified: true, records: [] },
  spv: { blockedPackages: 0, signerGaps: 0, records: [] },
  pages: { total: 0, records: [] }, imports: { total: 0, records: [] }, exports: { total: 0, records: [] }, beta: { total: 0, records: [] },
  audit: new Map(),
};
const none: SystemDashInput = { now, integrations: null, google: null, queues: null, automationRuns: null, jobs: null, health: null, spv: null, pages: null, imports: null, exports: null, beta: null, audit: null };

describe("buildSystemDashboard", () => {
  it("has 8 rings, 4 more and 12 bars, none with a ceiling, each with a popup", () => {
    const d = buildSystemDashboard(empty);
    expect(d.rings).toHaveLength(8);
    expect(d.more).toHaveLength(4);
    expect(d.timeline).toHaveLength(12);
    for (const m of [...d.rings, ...d.more]) expect(m.percent).toBeUndefined();
    const keys = [...d.rings, ...d.more].map((m) => m.id).concat([...d.need, ...d.integrations, ...d.actions, ...(d.timeline ?? [])].map((x) => x.key));
    for (const k of keys) {
      expect(d.popups[k], k).toBeDefined();
      expect(d.popups[k].extra.note).toContain("Source:");
      expect(d.popups[k].detail.length).toBeLessThanOrEqual(400);
      expect(d.popups[k].value.length).toBeLessThanOrEqual(60);
    }
  });

  it("shows empty messages for zero counts and the all clear action", () => {
    const d = buildSystemDashboard(empty);
    expect(d.popups.failed.extra.records).toBeUndefined();
    expect(d.popups.failed.extra.recordsEmpty).toBe("No deliveries failed in the last 24 hours.");
    expect(d.actions.map((a) => a.text)).toEqual([
      "Review blocked SPV packages and signer gaps before connecting DocuSign", "Slack and Webhook are disabled", "All clear: no deliveries are failing",
    ]);
    expect(d.need.map((n) => n.value)).toEqual(["3", "0"]);
  });

  it("says live without a count and Not available after a failed read", () => {
    expect(buildSystemDashboard(empty).rings.find((r) => r.id === "automation")?.valueText).toBe("live");
    expect(buildSystemDashboard({ ...empty, health: { verified: false, records: [] } }).popups.health.value).toBe("live");
    const d = buildSystemDashboard(none);
    expect(d.popups.failed.value).toBe("Not available");
    expect(d.popups.failed.extra.recordsEmpty).toBe("The records could not be read.");
    expect(d.timeline).toBeNull();
    expect(d.actions.some((a) => a.tone === "good")).toBe(false);
  });

  it("puts a delivery in its bar and opens its transaction without the error body", () => {
    const l = log("d1", "failed", "2026-11-25T11:30:00Z");
    const d = buildSystemDashboard({
      ...empty, integrations: { ...empty.integrations!, failed24h: 1, logs: [l], failedQueue: [l] }, audit: new Map([["d1", [{ at: "2026-11-25T11:31:00Z", text: "Integration delivery failed" }]]]),
    });
    expect(d.timeline?.[11]).toMatchObject({ total: 1, failed: 1 });
    const t = d.popups.t_11.extra.records?.[0].transaction;
    expect(t).toMatchObject({ id: "d1", attempts: "2 of 4", lastFailure: "2026-11-25 11:30 UTC", lastSuccess: "Not recorded" });
    expect(t?.audit?.map((a) => a.text)).toEqual(["Integration delivery failed", "Delivery queued"]);
    expect(JSON.stringify(d)).not.toContain("secret body");
    expect(d.pill.tone).toBe("bad");
  });

  it("uses no dashes as punctuation", () => {
    const d = buildSystemDashboard({ ...empty, health: { verified: true, records: [{ id: "Blocker 1", label: "Database — query failed", sub: "x", status: "Blocking", href: "/admin/system-health" }] } });
    expect(JSON.stringify(d)).not.toMatch(/[—–]| - /);
    expect(d.advisor.length).toBeLessThanOrEqual(400);
  });
});
