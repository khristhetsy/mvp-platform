import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildCoverEmail, buildTestCoverEmail } from "@/lib/contracts/email";

const base = { subject: "Proposal and term sheet for E-Artistry And Company Ltd", body: "Hi Erika,\n\nAttached are the documents.\n\nKhris", senderName: "Khris Thetsy" };

describe("Send test to me", () => {
  it("marks the subject [TEST] and says nothing went to the prospect", () => {
    const m = buildTestCoverEmail({ ...base, backUrl: "https://icapos.com/admin/sales/contracts/send?contact=x", prospectName: "Erika" });
    expect(m.subject).toBe(`[TEST] ${base.subject}`);
    expect(m.text).toContain("nothing was sent to Erika");
    expect(m.html).toContain("https://icapos.com/admin/sales/contracts/send?contact=x");
  });

  it("keeps the same body as the real cover email", () => {
    const real = buildCoverEmail({ ...base, url: "https://icapos.com/contracts/t" });
    const test = buildTestCoverEmail({ ...base, backUrl: "https://icapos.com/x", prospectName: "Erika" });
    expect(test.html).toContain("Attached are the documents.");
    expect(real.html).toContain("Attached are the documents.");
    expect(real.text).not.toContain("[TEST]");
  });

  it("uses the review only wording when there is no signature request", () => {
    const m = buildTestCoverEmail({ ...base, reviewOnly: true, backUrl: "https://icapos.com/x", prospectName: "Erika" });
    expect(m.text).toContain("No signature is requested.");
    expect(m.text).toContain("View documents");
  });
});
