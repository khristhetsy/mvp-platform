import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ to: string; subject: string }> = [];
let accept: (to: string) => boolean | Promise<boolean> = () => true;

vi.mock("@/lib/email/send-email", () => ({
  sendEmail: async (p: { to: string; subject: string }) => { sent.push({ to: p.to, subject: p.subject }); return accept(p.to); },
}));

import { sendBookingEmails } from "./notify";

const input = {
  bookingId: "b1", hostEmail: "host@icapos.com", hostName: "Host", bookerEmail: "ana@x.com", bookerName: "Ana",
  title: "Intro call", startTime: "2026-11-02T17:00:00Z", endTime: "2026-11-02T17:30:00Z", timezone: "America/Los_Angeles", meetUrl: null,
};

beforeEach(() => { sent.length = 0; accept = () => true; });

describe("sendBookingEmails result", () => {
  it("sends the same two emails as before and reports both accepted", async () => {
    expect(await sendBookingEmails(input)).toEqual({ booker: true, host: true });
    expect(sent).toEqual([{ to: "ana@x.com", subject: "Confirmed: Intro call" }, { to: "host@icapos.com", subject: "New booking: Intro call" }]);
  });

  it("reports a send the provider refused or that threw as not accepted", async () => {
    accept = (to) => (to === "ana@x.com" ? false : Promise.reject(new Error("down")));
    expect(await sendBookingEmails(input)).toEqual({ booker: false, host: false });
  });

  it("reports false for an email that had no recipient", async () => {
    expect(await sendBookingEmails({ ...input, hostEmail: null })).toEqual({ booker: true, host: false });
    expect(sent).toHaveLength(1);
  });
});
