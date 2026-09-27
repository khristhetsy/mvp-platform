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
});
