import { describe, expect, it } from "vitest";
import { buildDigestEmail } from "./digest";

const base = {
  firstName: "Ada",
  step: 1,
  dateLabel: "Tue, Sep 29",
  preferencesUrl: "https://icapos.com/founder/settings/email",
  instantOnlyUrl: "https://icapos.com/api/email/unsubscribe?t=abc",
  downshiftedFrom: null,
};

describe("buildDigestEmail", () => {
  it("leads with the step and lists every held item", () => {
    const e = buildDigestEmail({
      ...base,
      mode: "daily",
      items: [
        { subject: "Finish your data room", excerpt: "Two items left", url: "https://icapos.com/founder/readiness" },
        { subject: "Intro waiting on you", excerpt: null, url: null },
      ],
    });
    expect(e.subject).toBe("Your raise today: 1 thing to do, 2 updates");
    expect(e.html).toContain("You are on step 2 of 4: Ready.");
    expect(e.html).toContain("Finish the Ready step");
    expect(e.html).toContain("Finish your data room");
    expect(e.html).toContain("Only send me instant alerts");
    expect(e.text).toContain("Change how often you get this");
  });

  it("uses weekly wording, caps the rows and explains a downshift", () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ subject: `Update ${i}`, excerpt: null, url: null }));
    const e = buildDigestEmail({ ...base, mode: "weekly", items, downshiftedFrom: "daily" });
    expect(e.subject).toBe("Your week on iCapOS: 13 updates");
    expect(e.html).toContain("3 more in your iCapOS inbox.");
    expect(e.html).not.toContain("Update 12");
    expect(e.html).toContain("one email a week");
  });
});
