import { describe, it, expect } from "vitest";
import { buildReminderMessages, formatRange, type DueEvent } from "./reminders";
import { renderEmail } from "@/lib/email/layout";

const event: DueEvent = {
  id: "ev1",
  owner_id: "host1",
  title: "Meeting with Robert Lang",
  description: "Booked by: Robert Lang\nEmail: rlang@example.com",
  start_time: "2026-10-22T17:30:00.000Z",
  end_time: "2026-10-22T18:00:00.000Z",
  timezone: "America/Los_Angeles",
  location: null,
  meet_url: "https://meet.google.com/abc-defg-hij",
  attendees: [{ email: "rlang@example.com", name: "Robert Lang" }],
};
const owner = { email: "khris@example.com", full_name: "Khris Thetsy", role: "admin" };
const booking = {
  booker_name: "Robert Lang",
  booker_email: "rlang@example.com",
  booker_phone: "+1 415 555 0142",
  booker_company: "Lang Ventures",
  note: "I'd like to understand the Q3 pilot numbers.",
  answers: [{ label: "What would you like to discuss?", value: "Co-investing in the seed round" }, { label: "Empty", value: "" }],
};

describe("formatRange", () => {
  it("shows the day, the time span in the event timezone and the length", () => {
    expect(formatRange(event.start_time, event.end_time, event.timezone)).toBe("Thu, Oct 22 · 10:30 AM – 11:00 AM PDT (30 min)");
  });
  it("falls back to the start time when there is no end", () => {
    expect(formatRange(event.start_time, null, event.timezone)).toBe("Thu, Oct 22 · 10:30 AM PDT");
  });
});

describe("buildReminderMessages", () => {
  it("sends the host the contact, reason and note, and attendees the details only", () => {
    const [host, guest] = buildReminderMessages({ tier: "1h", event, owner, booking });
    expect(host.to).toEqual(["khris@example.com"]);
    const hostHtml = renderEmail(host.spec).html;
    expect(hostHtml).toContain("Lang Ventures");
    expect(hostHtml).toContain("+1 415 555 0142");
    expect(hostHtml).toContain("Reason for the call");
    expect(hostHtml).toContain("Co-investing in the seed round");
    expect(hostHtml).not.toContain(">Empty<");
    expect(hostHtml).toContain("Note from Robert");
    expect(hostHtml).toContain("/admin/calendar");
    // The booking already covers what the event description repeats.
    expect(hostHtml).not.toContain("Booked by:");

    expect(guest.to).toEqual(["rlang@example.com"]);
    expect(guest.replyTo).toBe("khris@example.com");
    const guestHtml = renderEmail(guest.spec).html;
    expect(guestHtml).not.toContain("Reason for the call");
    expect(guestHtml).not.toContain("Note from Robert");
    expect(guestHtml).toContain("Khris Thetsy");
    expect(guestHtml).toContain("calendar.google.com/calendar/render");
    expect(guestHtml).toContain("Reply to this email");
  });

  it("shows the attendees and event notes to the host when there is no booking", () => {
    const [host] = buildReminderMessages({ tier: "24h", event: { ...event, description: "Review the term sheet." }, owner, booking: null });
    const html = renderEmail(host.spec).html;
    expect(html).toContain("Attendees");
    expect(html).toContain("Review the term sheet.");
    expect(html).toContain("Your meeting is tomorrow");
  });

  it("does not send the owner the attendee copy", () => {
    const messages = buildReminderMessages({
      tier: "1h",
      event: { ...event, attendees: [{ email: "KHRIS@example.com" }] },
      owner,
      booking: null,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toEqual(["khris@example.com"]);
  });
});
