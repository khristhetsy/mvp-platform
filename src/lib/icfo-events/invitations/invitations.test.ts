import { describe, expect, it } from "vitest";
import { mergePrefill, normPhone, planContactChanges, type ContactSnapshot } from "@/lib/icfo-events/invitations/contact-sync";
import { defaultStatSettings, normalizeStatSettings, statTiles, STAT_ORDER, type StatCounts } from "@/lib/icfo-events/invitations/types";
import { inviteSubject, renderInviteEmail, seriesName, DISCLAIMER } from "@/lib/icfo-events/invitations/emails";
import { chosenActivities, nextAttendeeStep, nextInviteStep } from "@/lib/icfo-events/invitations/runner";
import { countFounderInvestorMatches } from "@/lib/icfo-events/invitations/live-stats";
import { cleanAudiences } from "@/lib/icfo-events/invitations/store";

const base: ContactSnapshot = {
  name: "Maya Chen", company: "Ridgeline Bio", title: "CEO", country: "Australia",
  email: "maya@ridgeline.bio", email2: null, phone: "+61 412 555 019", phone2: null,
};

describe("planContactChanges", () => {
  it("records a changed title and leaves unchanged fields alone", () => {
    const p = planContactChanges(base, { name: "maya chen", title: "Founder and CEO", email: "MAYA@ridgeline.bio", phone: "+61412555019" });
    expect(p.patch).toEqual({ job_position: "Founder and CEO" });
    expect(p.changes.map((c) => c.field)).toEqual(["title"]);
  });

  it("never overwrites the main phone or email; new values go to the second slot", () => {
    const p = planContactChanges(base, { email: "maya.chen@gmail.com", phone: "+61 433 210 887" });
    expect(p.patch.phone).toBeUndefined();
    expect(p.patch.email).toBeUndefined();
    expect(p.patch.phone2).toBe("+61 433 210 887");
    expect(p.email2).toBe("maya.chen@gmail.com");
  });

  it("fills the main slot when it is empty", () => {
    const p = planContactChanges({ ...base, phone: null }, { phone: "+61 433 210 887" });
    expect(p.patch.phone).toBe("+61 433 210 887");
    expect(p.patch.phone2).toBeUndefined();
  });

  it("does nothing when the value matches the second slot", () => {
    const p = planContactChanges({ ...base, phone2: "+61433210887" }, { phone: "+61 433-210 887" });
    expect(p.changes).toHaveLength(0);
  });

  it("replaces an older second value and keeps it in the change record", () => {
    const p = planContactChanges({ ...base, email2: "old@x.com" }, { email: "new@x.com" });
    expect(p.email2).toBe("new@x.com");
    expect(p.changes[0]).toMatchObject({ field: "email2", before: "old@x.com", after: "new@x.com" });
  });

  it("a blank answer never clears a stored value", () => {
    expect(planContactChanges(base, { company: "  ", phone: "" }).changes).toHaveLength(0);
  });
});

describe("normPhone", () => {
  it("keeps the leading plus and digits only", () => expect(normPhone("+61 (412) 555-019")).toBe("+61412555019"));
});

describe("mergePrefill", () => {
  it("takes the first non-empty value in source order", () => {
    const m = mergePrefill([
      { name: "profile", values: { name: "Maya C", email: "" } },
      { name: "contact", values: { name: "Maya Chen", email: "maya@ridgeline.bio", phone: null } },
      { name: "registration", values: { phone: "+61 1", stage: "Seed", sectors: [] } },
    ]);
    expect(m.answers).toEqual({ name: "Maya C", email: "maya@ridgeline.bio", phone: "+61 1", stage: "Seed" });
    expect(m.from).toMatchObject({ name: "profile", email: "contact", phone: "registration" });
  });
});

const counts: StatCounts = { investors: 86, founders: 4, advisors: 0, matches: 312, presentations: 11, spotlights: null, panelists: 0 };

describe("statTiles", () => {
  it("shows a label instead of a number below its minimum, and never invents one", () => {
    const tiles = statTiles(counts, defaultStatSettings(), STAT_ORDER.founder);
    const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));
    expect(byKey.investors).toMatchObject({ value: "86", counted: true });
    expect(byKey.founders).toMatchObject({ value: "Opening soon", counted: false });
    expect(byKey.spotlights.counted).toBe(false);
    expect(byKey.panelists.counted).toBe(false);
    expect(tiles[0].key).toBe("investors");
  });

  it("leaves hidden numbers out", () => {
    const s = defaultStatSettings();
    s.items.matches.show = false;
    expect(statTiles(counts, s, STAT_ORDER.advisor).some((t) => t.key === "matches")).toBe(false);
  });

  it("normalizes stored settings", () => {
    const s = normalizeStatSettings({ per: "event", items: { investors: { show: false, min: "3" }, bogus: {} } });
    expect(s.per).toBe("event");
    expect(s.items.investors).toEqual({ show: false, min: 3 });
    expect(s.items.founders.min).toBe(10);
  });
});

describe("emails", () => {
  it("names the series without the city suffix", () => {
    expect(seriesName(["iCFO PE Expo — Paris | Dec 15", "iCFO PE Expo — Singapore | Nov 17"])).toBe("iCFO PE Expo");
  });

  it("leads the subject with the audience's number only when it is counted", () => {
    const tiles = statTiles(counts, defaultStatSettings(), STAT_ORDER.founder);
    expect(inviteSubject("founder", "invite", "iCFO PE Expo", tiles)).toBe("86 investors are registered for the iCFO PE Expo");
    const invTiles = statTiles(counts, defaultStatSettings(), STAT_ORDER.investor);
    expect(inviteSubject("investor", "invite", "iCFO PE Expo", invTiles)).toBe("Prescreened founders and one on one meetings at the iCFO PE Expo");
  });

  it("carries the disclaimer and no sentence dashes", () => {
    const { html, subject } = renderInviteEmail({
      role: "investor", step: "invite", firstName: "David",
      events: [{ title: "iCFO PE Expo — Paris | Dec 15", dateLabel: "Dec 15", url: "https://icapos.com/events/paris" }],
      offers: ["prescreened", "one_on_one"], tiles: [], statsImageUrl: null, ctaUrl: "https://icapos.com/events/invite/x",
    });
    expect(html).toContain(DISCLAIMER);
    expect(html).toContain("One on one founder meetings");
    expect(html).not.toContain("Talk show panelist");
    expect(subject).not.toMatch(/ — | – /);
  });
});

describe("nextInviteStep", () => {
  const day = 86400000;
  const t0 = Date.parse("2026-10-06T09:00:00Z");
  const far = new Date(t0 + 60 * day).toISOString();
  const sent = new Date(t0).toISOString();

  it("sends the invite first", () => {
    expect(nextInviteStep({ now: t0, stepsSent: [], firstSentAt: null, openedAt: null, nextEventStart: far })).toEqual({ step: "invite", send: true });
  });
  it("day 3 goes only to people who opened", () => {
    expect(nextInviteStep({ now: t0 + 3 * day, stepsSent: ["invite"], firstSentAt: sent, openedAt: sent, nextEventStart: far })).toEqual({ step: "day3", send: true });
    expect(nextInviteStep({ now: t0 + 3 * day, stepsSent: ["invite"], firstSentAt: sent, openedAt: null, nextEventStart: far })).toEqual({ step: "day3", send: false });
  });
  it("day 7 goes only to people who never opened", () => {
    expect(nextInviteStep({ now: t0 + 7 * day, stepsSent: ["invite", "day3:skip"], firstSentAt: sent, openedAt: null, nextEventStart: far })).toEqual({ step: "day7", send: true });
  });
  it("last call 5 days before the next event", () => {
    const start = new Date(t0 + 20 * day).toISOString();
    expect(nextInviteStep({ now: t0 + 16 * day, stepsSent: ["invite", "day3", "day7:skip"], firstSentAt: sent, openedAt: sent, nextEventStart: start })).toEqual({ step: "lastcall", send: true });
    expect(nextInviteStep({ now: t0 + 14 * day, stepsSent: ["invite", "day3", "day7:skip"], firstSentAt: sent, openedAt: sent, nextEventStart: start })).toBeNull();
  });
});

describe("nextAttendeeStep", () => {
  const start = "2026-10-20T19:00:00Z";
  const s = Date.parse(start);
  it("confirms, then reminds a day and an hour before, then follows up", () => {
    expect(nextAttendeeStep(s - 10 * 86400000, start, null, [])).toBe("confirm");
    expect(nextAttendeeStep(s - 20 * 3600000, start, null, ["confirm"])).toBe("reminder_1d");
    expect(nextAttendeeStep(s - 30 * 60000, start, null, ["confirm", "reminder_1d"])).toBe("reminder_1h");
    expect(nextAttendeeStep(s + 20 * 3600000, start, null, ["confirm", "reminder_1d", "reminder_1h"])).toBe("followup");
    expect(nextAttendeeStep(s + 5 * 86400000, start, null, ["confirm"])).toBeNull();
  });
});

describe("chosenActivities", () => {
  it("lists what an investor ticked", () => {
    expect(chosenActivities("investor", { oneOnOneMeetings: true, talkShowPanelist: false })).toEqual([
      "Prescreened presentations", "One on one founder meetings", "Networking sessions",
    ]);
  });
});

describe("countFounderInvestorMatches", () => {
  it("counts founder and investor pairs sharing a sector", () => {
    const rows = [
      { event_id: "e", attendee_type: "founder", answers: { sectors: ["Healthcare"] } },
      { event_id: "e", attendee_type: "founder", answers: { sectors: ["Energy"] } },
      { event_id: "e", attendee_type: "investor", answers: { sectors: ["Healthcare", "Fintech"] } },
      { event_id: "e", attendee_type: "investor", answers: { sectors: ["Healthcare"] } },
    ];
    expect(countFounderInvestorMatches(rows)).toBe(2);
  });
});

describe("cleanAudiences", () => {
  it("keeps known roles and offers, once each", () => {
    const a = cleanAudiences([{ role: "investor", listId: "l1", offers: ["panelist", "bogus"] }, { role: "investor" }, { role: "x" }]);
    expect(a).toEqual([{ role: "investor", listId: "l1", offers: ["panelist"], subject: null, intro: null }]);
  });
});
