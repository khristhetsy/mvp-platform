import { describe, it, expect } from "vitest";
import { bodyHtml } from "./notify";

describe("bodyHtml — booking confirmation copy", () => {
  it("names the other party once and never doubles it", () => {
    // Host email for an auto-titled booking: greet the host, reference the booker.
    const html = bodyHtml({ greetingName: "Khris Thetsy", otherName: "Khris Thetsy", when: "Fri, Sep 11, 5:30 PM", meetUrl: null });
    expect(html).toContain("Hi Khris Thetsy,");
    expect(html).toContain("Your meeting with <strong>Khris Thetsy</strong> is confirmed.");
    // The old bug rendered "Meeting with Khris Thetsy with Khris Thetsy".
    expect(html).not.toMatch(/with Khris Thetsy with Khris Thetsy/);
    expect(html).not.toContain("Meeting with Khris Thetsy with");
  });

  it("falls back cleanly when the other party has no name", () => {
    const html = bodyHtml({ greetingName: "Jordan", otherName: null, when: "Mon", meetUrl: null });
    expect(html).toContain("Your meeting is confirmed.");
    expect(html).not.toContain("with <strong>");
  });

  it("includes the Meet link when present", () => {
    const html = bodyHtml({ greetingName: "A", otherName: "B", when: "Tue", meetUrl: "https://meet.google.com/abc-def-ghi" });
    expect(html).toContain('href="https://meet.google.com/abc-def-ghi"');
  });
});
