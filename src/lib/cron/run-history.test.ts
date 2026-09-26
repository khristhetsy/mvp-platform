import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rows: Record<string, Array<Record<string, unknown>>> = {};
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: async () => ({ data: rows[table] ?? [] }),
      };
      return chain;
    },
  }),
}));

import { describePhase, loadJobRunHistory, loadCodeUpdates } from "./run-history";

describe("describePhase", () => {
  it("names where an unfinished run stopped", () => {
    expect(describePhase("started", false)).toBe("Started, no step finished");
    expect(describePhase("match_notifications:running", false)).toBe("Stopped in Match notices");
    expect(describePhase("scheduled_digest_pass:done", false)).toBe("Stopped after Digests");
  });
  it("names the last step of a finished run", () => {
    expect(describePhase("investor_outreach_send:done", true)).toBe("Finished after Outreach sends");
    expect(describePhase(null, true)).toBeNull();
  });
});

describe("loadJobRunHistory", () => {
  it("marks a run still open past the time limit as timed out", async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    const fresh = new Date(Date.now() - 30_000).toISOString();
    rows.cron_runs = [
      { started_at: fresh, duration_ms: null, status: "running", http_status: null, detail: null },
      { started_at: old, duration_ms: null, status: "running", http_status: null, detail: null },
      { started_at: old, duration_ms: 500, status: "ok", http_status: 200, detail: null },
    ];
    const runs = await loadJobRunHistory("/api/cron/founder-nudges");
    expect(runs.map((r) => r.outcome)).toEqual(["running", "timed_out", "ok"]);
  });

  it("reads steps for orchestration", async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    rows.orchestration_runs = [
      { started_at: old, completed_at: null, duration_ms: null, status: "running", metadata: { phase: "started" } },
      { started_at: old, completed_at: old, duration_ms: 28000, status: "success", metadata: { phase: "investor_outreach_send:done" } },
    ];
    const runs = await loadJobRunHistory("/api/cron/run-orchestration");
    expect(runs[0]).toMatchObject({ outcome: "timed_out", step: "Started, no step finished" });
    expect(runs[1]).toMatchObject({ outcome: "ok", step: "Finished after Outreach sends" });
  });
});

describe("loadCodeUpdates", () => {
  it("returns the queue rows", async () => {
    rows.dev_patch_queue = [{ id: 18, created_at: "2026-09-26T08:35:09Z", title: "t", status: "pending", applied_sha: null, applied_at: null, result: null }];
    expect(await loadCodeUpdates()).toHaveLength(1);
  });
});
