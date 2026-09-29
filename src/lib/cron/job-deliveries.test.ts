import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: null }>>(async () => ({ error: null }));
const del = { lt: vi.fn(async () => ({})) };
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert, delete: () => del }) }),
}));

import { recordDelivery } from "@/lib/cron/job-deliveries";
import { runInJob, currentJob } from "@/lib/cron/job-context";

describe("job send log", () => {
  beforeEach(() => insert.mockClear());

  it("records nothing outside a scheduled job", async () => {
    expect(currentJob()).toBeNull();
    await recordDelivery({ channel: "email", toEmail: "a@b.co", subject: "Hi", status: "sent" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("records each send against the running job", async () => {
    await runInJob({ job: "/api/cron/founder-nudges", runId: 42 }, async () => {
      await recordDelivery({ channel: "email", toEmail: "a@b.co", subject: "2 documents left", bodyHtml: "<p>x</p>", status: "sent" });
      await recordDelivery({ channel: "in_app", recipientUserId: "u1", subject: "2 documents left", message: "Add your cap table.", status: "skipped", error: "muted" });
    });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toMatchObject({ job: "/api/cron/founder-nudges", run_id: 42, channel: "email", to_email: "a@b.co", status: "sent" });
    expect(insert.mock.calls[1][0]).toMatchObject({ channel: "in_app", recipient_user_id: "u1", status: "skipped", error: "muted" });
  });

  it("keeps the job apart for concurrent runs", async () => {
    const seen: string[] = [];
    await Promise.all([
      runInJob({ job: "A", runId: 1 }, async () => { await new Promise((r) => setTimeout(r, 5)); seen.push(currentJob()!.job); }),
      runInJob({ job: "B", runId: 2 }, async () => { seen.push(currentJob()!.job); }),
    ]);
    expect(seen.sort()).toEqual(["A", "B"]);
  });
});
