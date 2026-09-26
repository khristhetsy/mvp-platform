import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the two tables the gate touches.
const state: { paused: Record<string, unknown>; runs: Array<Record<string, unknown>> } = { paused: {}, runs: [] };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      if (table === "platform_settings") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: state.paused } }) }) }),
          upsert: async (row: { value: Record<string, unknown> }) => {
            state.paused = row.value;
            return { error: null };
          },
        };
      }
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const id = state.runs.length + 1;
              state.runs.push({ id, ...row });
              return { data: { id } };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_c: string, id: number) => {
            Object.assign(state.runs[id - 1]!, patch);
            return { error: null };
          },
        }),
        delete: () => ({ eq: () => ({ lt: async () => ({ error: null }) }) }),
      };
    },
  }),
}));

import { setCronsPaused, withCronGate } from "@/lib/cron/gate";

const JOB = "/api/cron/founder-nudges";
const authed = () => new Request("https://icapos.com" + JOB, { headers: { authorization: "Bearer s3cret" } });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  state.paused = {};
  state.runs = [];
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("withCronGate", () => {
  it("runs the job and logs start, finish and status", async () => {
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const res = await withCronGate(JOB, handler)(authed());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({ job: JOB, status: "ok", http_status: 200 });
  });

  it("skips a paused job without calling it", async () => {
    await setCronsPaused([JOB], true, { id: "u1", name: "Khris" });
    const handler = vi.fn(async () => new Response("ok"));
    const res = await withCronGate(JOB, handler)(authed());
    expect(handler).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ ok: true, skipped: "paused" });
    expect(state.runs[0]).toMatchObject({ status: "skipped" });
  });

  it("runs again after resume", async () => {
    await setCronsPaused([JOB], true, { id: "u1", name: "Khris" });
    await setCronsPaused([JOB], false, { id: "u1", name: "Khris" });
    const handler = vi.fn(async () => new Response("ok"));
    await withCronGate(JOB, handler)(authed());
    expect(handler).toHaveBeenCalledOnce();
  });

  it("leaves calls without the cron secret to the handler, unlogged", async () => {
    await setCronsPaused([JOB], true, { id: "u1", name: "Khris" });
    const handler = vi.fn(async () => new Response("no", { status: 401 }));
    const res = await withCronGate(JOB, handler)(new Request("https://icapos.com" + JOB));
    expect(res.status).toBe(401);
    expect(handler).toHaveBeenCalledOnce();
    expect(state.runs).toHaveLength(0);
  });

  it("logs a failed status and a thrown error", async () => {
    await withCronGate(JOB, async () => new Response("x", { status: 500 }))(authed());
    expect(state.runs[0]).toMatchObject({ status: "error", http_status: 500 });
    await expect(withCronGate(JOB, async () => { throw new Error("boom"); })(authed())).rejects.toThrow("boom");
    expect(state.runs[1]).toMatchObject({ status: "error", detail: "boom" });
  });
});
