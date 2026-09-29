import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/notifications/founder-nudges", () => ({
  planJourneyNudges: async () => [
    { founderId: "f1", founderName: "Ergin Yildiz", email: "e@x.co", companyName: "Liposomal", stage: "qualify",
      notification: { title: "3 documents left before investor matching", message: "Add your pitch deck." }, mail: { subject: "s", html: "<p>h</p>", text: "t" } },
    { founderId: "f2", founderName: "No Email", email: null, companyName: null, stage: "deploy",
      notification: { title: "Keep your investor outreach moving", message: "m" }, mail: null },
  ],
}));

vi.mock("@/lib/matching/match-digest", () => ({
  runFounderMatchDigest: async (opts: { dryRun?: boolean }) => ({
    founders: 1, companies: 1, sent: 1, skippedNothingNew: 0, skippedPrefs: 0, failed: 0, dryRun: Boolean(opts.dryRun),
    preview: opts.dryRun
      ? [{ companyId: "c1", to: "t@k.inc", subject: "Todd, 25 investors match KoreInside", recipientName: "Todd Bertsch", companyName: "KoreInside", text: "t", html: "<p>m</p>" }]
      : undefined,
  }),
}));

import { JOB_PREVIEWS } from "@/lib/cron/job-previews";
import { PREVIEW_JOB_PATHS } from "@/lib/cron/preview-paths";

describe("Next run previews", () => {
  it("lists the same jobs on the page and on the server", () => {
    expect([...PREVIEW_JOB_PATHS].sort()).toEqual(Object.keys(JOB_PREVIEWS).sort());
  });

  it("shows founder nudges from the job's own plan", async () => {
    const items = await JOB_PREVIEWS["/api/cron/founder-nudges"].load();
    expect(items[0]).toMatchObject({ recipientName: "Ergin Yildiz", channels: ["email", "in_app"], html: "<p>h</p>", subject: "3 documents left before investor matching" });
    expect(items[1]).toMatchObject({ channels: ["in_app"], html: null });
  });

  it("shows the weekly match email from a dry run of the job", async () => {
    const items = await JOB_PREVIEWS["/api/cron/founder-match-digest"].load();
    expect(items).toEqual([
      { recipientName: "Todd Bertsch", toEmail: "t@k.inc", companyName: "KoreInside", subject: "Todd, 25 investors match KoreInside", channels: ["email"], message: "t", html: "<p>m</p>" },
    ]);
  });
});
