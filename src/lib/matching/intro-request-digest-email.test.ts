import { describe, expect, it } from "vitest";
import { digestIsEmpty, digestSubject, renderIntroDigestEmail, waitingLine } from "@/lib/matching/intro-request-digest-email";

const urls = { prospectQueueUrl: "https://icapos.com/admin/prospect-intros", memberQueueUrl: "https://icapos.com/admin/intro-requests" };

describe("intro request digest", () => {
  it("leads with new requests, else with what is waiting", () => {
    expect(digestSubject({ fresh: [{ companyName: "A", investorName: "B", kind: "prospect" }], waiting: 5 })).toBe("1 new introduction request");
    expect(digestSubject({ fresh: [], waiting: 2 })).toBe("2 introduction requests waiting on you");
  });

  it("states the oldest waiting age", () => {
    expect(waitingLine(5, 2)).toBe("Waiting on you: 5 requests, oldest 2 days");
    expect(waitingLine(1, 0)).toBe("Waiting on you: 1 request, oldest from today");
    expect(waitingLine(0, null)).toBeNull();
  });

  it("is empty only when nothing is new and nothing waits", () => {
    expect(digestIsEmpty({ fresh: [], waiting: 0 })).toBe(true);
    expect(digestIsEmpty({ fresh: [], waiting: 1 })).toBe(false);
  });

  it("lists up to ten and counts the rest", () => {
    const fresh = Array.from({ length: 12 }, (_, i) => ({ companyName: `Co ${i}`, investorName: `Inv ${i}`, kind: "member" as const }));
    const out = renderIntroDigestEmail({ fresh, waiting: 12, oldestWaitingDays: 0, ...urls });
    expect(out.text).toContain("Co 9 to Inv 9");
    expect(out.text).not.toContain("Co 10 to Inv 10");
    expect(out.text).toContain("and 2 more");
  });

  it("marks prospects", () => {
    const out = renderIntroDigestEmail({ fresh: [{ companyName: "Acme", investorName: "Tarra Sharp", kind: "prospect" }], waiting: 1, oldestWaitingDays: 0, ...urls });
    expect(out.text).toContain("Acme to Tarra Sharp (prospect)");
  });
});
