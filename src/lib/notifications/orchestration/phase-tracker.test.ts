import { describe, expect, it } from "vitest";

import { createPhaseTracker } from "@/lib/notifications/orchestration/execution-log";

function fakeDb() {
  const writes: Array<Record<string, unknown>> = [];
  const db = {
    from: () => ({
      update: (row: Record<string, unknown>) => ({
        eq: async () => {
          writes.push(JSON.parse(JSON.stringify(row.metadata)));
          return { error: null };
        },
      }),
    }),
  };
  return { db, writes };
}

describe("phase tracker", () => {
  it("marks each step running then done, with its duration", async () => {
    const { db, writes } = fakeDb();
    const t = createPhaseTracker(db as never, "run-1", Date.now());
    const out = await t.run("step_a", async () => 42);
    expect(out).toBe(42);
    expect(writes.map((w) => w.phase)).toEqual(["step_a:running", "step_a:done"]);
    expect(typeof t.phases.step_a).toBe("number");
  });

  it("leaves the running marker when a step never returns, and records failures", async () => {
    const { db, writes } = fakeDb();
    const t = createPhaseTracker(db as never, "run-1", Date.now());
    await expect(t.run("step_b", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(writes.at(-1)?.phase).toBe("step_b:done");
    void t.run("stuck", () => new Promise(() => {}));
    await Promise.resolve();
    expect(writes.at(-1)?.phase).toBe("stuck:running");
  });

  it("writes nothing without a run id", async () => {
    const { db, writes } = fakeDb();
    await createPhaseTracker(db as never, null, Date.now()).run("x", async () => 1);
    expect(writes).toHaveLength(0);
  });
});
