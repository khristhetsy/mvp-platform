/**
 * The renderer that actually feeds preview and send.
 *
 * There are two ways an event email can be produced — `renderEventEmail` here,
 * and the editable block document in `blocks.ts`. The roster sections were
 * added to the block builder first and nothing changed on screen, because the
 * preview and the send both go through this file. These tests exist so that
 * gap can't reopen silently.
 */
import { describe, it, expect } from "vitest";
import { renderEventEmail } from "@/lib/event-email/render";
import type { EventMergeData } from "@/lib/event-email/merge";

const person = (over: Partial<EventMergeData["presenters"][number]> = {}) => ({
  name: "Jane Doe",
  role: "Presenter",
  company: "Acme",
  headshotUrl: null,
  initials: "JD",
  bio: "",
  companySummary: "",
  sessionId: null,
  ...over,
});

const merge = (over: Partial<EventMergeData> = {}): EventMergeData => ({
  eventId: "evt-1",
  title: "iCFO PE Expo — Las Vegas",
  badge: "iCFO PE Expo",
  tagline: "",
  dateLabel: "Tuesday, September 22, 2026",
  timeRange: "12:00 PM – 4:00 PM",
  formatLine: "Webinar · Free registration",
  bannerUrl: null,
  registerUrl: "https://icapos.com/events/x",
  lobbyUrl: "https://icapos.com/events/x/lobby",
  bookletUrl: null,
  sessions: [],
  sponsorLockup: null,
  organizerLine: "iCFO Capital Global, Inc.",
  presenters: [],
  attendees: { investors: [], founders: [], total: 0 },
  sponsorTiers: { presenting: [], track: [], community: [] },
  ...over,
});

const render = (m: EventMergeData, opts = {}) => renderEventEmail(m, { type: "invite", ...opts });

describe("the who's-presenting sections reach the rendered email", () => {
  it("names the companies — the bug was that this renderer never did", () => {
    const html = render(merge({ presenters: [person({ name: "Bob Wood", company: "Scriptive" })] }));
    expect(html).toContain("Presenting companies");
    expect(html).toContain("Scriptive");
    expect(html).toContain("Bob Wood");
  });

  it("gives the Founder Showcase its own section with the pitch line", () => {
    const html = render(merge({
      presenters: [person({ name: "Shailesh Shah", company: "SOHM", role: "Founder showcase", companySummary: "Generic pharmaceuticals." })],
    }));
    expect(html).toContain("Founder Showcase");
    expect(html).toContain("SOHM");
    expect(html).toContain("Generic pharmaceuticals.");
  });

  it("lists exhibitors on one line", () => {
    const html = render(merge({
      presenters: [
        person({ name: "NAI", company: "NAI Technology", role: "Exhibitor" }),
        person({ name: "Imp", company: "Impervitex Corp", role: "Exhibitor" }),
      ],
    }));
    expect(html).toContain("NAI Technology · Impervitex Corp");
  });

  it("renders nothing at all when the roster is empty", () => {
    const html = render(merge());
    expect(html).not.toContain("Presenting companies");
    expect(html).not.toContain("Founder Showcase");
    expect(html).not.toContain("Exhibitors");
  });

  it("can be switched off", () => {
    const html = render(merge({ presenters: [person({ company: "Scriptive" })] }), { includeRoster: false });
    expect(html).not.toContain("Presenting companies");
    expect(html).not.toContain("Scriptive");
  });
});

describe("session guests are billed under their session", () => {
  const withTalkShow = merge({
    sessions: [{ id: "sess-1", type: "talk_show", title: "Inside the Investor's Mind", abstract: "", accent: "#7c3aed" }],
    presenters: [
      person({ name: "Marcus Reyes", company: "Tessellate Ventures", role: "Investor", sessionId: "sess-1" }),
      person({ name: "Shan Padda", company: "Harvard MedTech", role: "Guest CEO", sessionId: "sess-1" }),
      person({ name: "Bob Wood", company: "Scriptive", role: "Presenter" }),
    ],
  });

  it("names them inside the session card", () => {
    const html = render(withTalkShow);
    const card = html.slice(html.indexOf("Inside the Investor"), html.indexOf("Presenting companies"));
    expect(card).toContain("Shan Padda");
    expect(card).toContain("Marcus Reyes");
    expect(card).toContain("Guest CEO");
  });

  it("introduces the guest CEO before the investor", () => {
    const html = render(withTalkShow);
    expect(html.indexOf("Shan Padda")).toBeLessThan(html.indexOf("Marcus Reyes"));
  });

  it("keeps them out of the flat lists, so nobody appears twice", () => {
    const html = render(withTalkShow);
    const roster = html.slice(html.indexOf("Presenting companies"));
    expect(roster).toContain("Scriptive");
    expect(roster).not.toContain("Tessellate Ventures");
  });
});

describe("email-safe output", () => {
  it("lays the columns out as table cells, not CSS grid", () => {
    const html = render(merge({ presenters: [person({ company: "Acme" })] }));
    expect(html).not.toContain("display:grid");
    expect(html).not.toContain("display:flex");
  });

  it("escapes a company name that contains markup", () => {
    const html = render(merge({ presenters: [person({ company: "<script>x</script>" })] }));
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("still carries the compliance footer", () => {
    expect(render(merge({ presenters: [person()] }))).toContain("Nothing in this email is an offer to sell");
  });
});

describe("who's coming — the attendee list", () => {
  const withAttendees = (over = {}) => merge({
    attendees: { investors: ["Marcus Reyes", "Aisha Kamara"], founders: ["Shan Padda"], total: 15, ...over },
  });

  it("names the people who agreed to be listed", () => {
    const html = render(withAttendees());
    expect(html).toContain("Who&rsquo;s coming");
    expect(html).toContain("Marcus Reyes");
    expect(html).toContain("Shan Padda");
  });

  it("groups them and counts each group", () => {
    const html = render(withAttendees());
    expect(html).toContain("Investors · 2");
    expect(html).toContain("Founders · 1");
  });

  it("caps each group at six, then says how many more", () => {
    const many = Array.from({ length: 10 }, (_, i) => `Investor ${i + 1}`);
    const html = render(withAttendees({ investors: many }));
    expect(html).toContain("Investor 6");
    expect(html).not.toContain("Investor 7");
    expect(html).toContain("+ 4 more investors");
  });

  it("renders nothing when nobody registered as an investor or founder", () => {
    const html = render(merge({ attendees: { investors: [], founders: [], total: 41 } }));
    expect(html).not.toContain("Who&rsquo;s coming");
  });

  it("can be switched off", () => {
    const html = render(withAttendees(), { includeAttendees: false });
    expect(html).not.toContain("Who&rsquo;s coming");
    expect(html).not.toContain("Marcus Reyes");
  });
});
