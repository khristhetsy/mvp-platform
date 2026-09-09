import { describe, it, expect } from "vitest";
import { bookingEmailHtml } from "./notify";

const base = {
  title: "Intro call",
  inviteeName: "Troy Brazell",
  inviteeEmail: "troy@example.com",
  whenText: "8:30 – 9:00 AM, Tuesday, January 20, 2026",
  timezone: "America/Denver",
  durationMin: 30,
  meetUrl: "https://meet.google.com/abc-def-ghi",
  answers: [{ label: "Purpose", value: "Investment Conference" }],
  addToCalUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
  cancelUrl: "https://icapos.com/schedule/cancel/tok",
  rescheduleUrl: "https://icapos.com/schedule/reschedule/tok",
};

describe("bookingEmailHtml", () => {
  it("renders the event card, responses, and all three action links", () => {
    const html = bookingEmailHtml({ ...base, greetingName: "Troy Brazell", heroTitle: "You're scheduled", heroSub: "A calendar invitation has been sent." });
    expect(html).toContain("You're scheduled");
    expect(html).toContain("Intro call");
    expect(html).toContain("30 minutes");
    expect(html).toContain("Troy Brazell");
    expect(html).toContain("Investment Conference"); // response value
    expect(html).toContain("Join"); // meet button
    expect(html).toContain(base.addToCalUrl);
    expect(html).toContain(base.cancelUrl);
    expect(html).toContain(base.rescheduleUrl);
  });

  it("omits Cancel/Reschedule links when not provided", () => {
    const html = bookingEmailHtml({ ...base, cancelUrl: null, rescheduleUrl: null, greetingName: "Troy", heroTitle: "You're scheduled", heroSub: "x" });
    expect(html).toContain("Add to calendar");
    expect(html).not.toContain("Reschedule");
    expect(html).not.toContain("/schedule/cancel/");
  });

  it("escapes user-supplied values", () => {
    const html = bookingEmailHtml({ ...base, inviteeName: "<script>x</script>", greetingName: "x", heroTitle: "y", heroSub: "z" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
