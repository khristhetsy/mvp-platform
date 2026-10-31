import { describe, expect, it } from "vitest";
import { buildMeetingBrief, meetingQuestions, suggestTasks } from "./brief";
import { buildFollowUpParts, renderBody, writtenText } from "./draft";
import { draftViolations } from "./guards";
import { suggestAfterMeeting, type StageLite } from "./stages";
import { buildAudit } from "./audit";
import { OBJECTIONS } from "./types";

const opp = { title: "Acme Robotics", contact_email: "dana@acme.test", value_cents: null, expected_close: null };

describe("meetingQuestions", () => {
  it("uses the training's questions 1, 2 and 4 when nothing is known", () => {
    expect(meetingQuestions("unknown")).toHaveLength(3);
  });
  it("puts the question for a known objection first, without repeating it", () => {
    const q = meetingQuestions("timing");
    expect(q[0]).toBe("When do you want to decide and begin?");
    expect(new Set(q).size).toBe(q.length);
  });
});

describe("buildMeetingBrief", () => {
  it("lists only what the record says, and says what is missing", () => {
    const audit = buildAudit({ opportunity: opp, stageName: "Meeting", items: [], chats: [], quotes: { asked: "Thanks for the introduction", concern: null }, aiRead: true });
    const brief = buildMeetingBrief({ title: "Acme Robotics", contactName: "Dana Whitfield", stageName: "Meeting", audit });
    expect(brief.who).toBe("Dana Whitfield, Acme Robotics");
    expect(brief.said.map((s) => s.quote)).toEqual([true]);
    expect(brief.notOnFile).toEqual(["Deal value", "Expected close date"]);
    expect(brief.likelyObjection).toContain("Not known yet");
  });
});

describe("suggestTasks", () => {
  it("offers a follow up and a call, plus a team check when the objection was the team", () => {
    expect(suggestTasks({ contactName: "Dana", objection: "money" }).map((t) => t.taskType)).toEqual(["Email", "Call"]);
    expect(suggestTasks({ contactName: "Dana", objection: "team" }).map((t) => t.taskType)).toEqual(["Email", "Call", "Follow-up"]);
  });
  it("falls back when there is no contact name", () => {
    expect(suggestTasks({ contactName: null, objection: "money" })[0].title).toBe("Send the follow up to the contact");
  });
});

describe("buildFollowUpParts", () => {
  it("thanks them and never quotes anything from the person's notes", () => {
    const body = renderBody(buildFollowUpParts({ firstName: "Dana", objection: "money", chatUrl: "https://icapos.com/x/y?src=opp-0123456789", includeRefundOffer: true }));
    expect(body.startsWith("Hi Dana,")).toBe(true);
    expect(body).toContain("Thank you for the time today.");
    expect(body).toContain("What would it take to move forward?");
    expect(body.trim().endsWith("Click here to respond: https://icapos.com/x/y?src=opp-0123456789")).toBe(true);
  });
  it("keeps every written line clear of the banned words for every objection", () => {
    for (const objection of OBJECTIONS) {
      for (const chatUrl of ["https://icapos.com/x/y?src=opp-0123456789", null]) {
        const parts = buildFollowUpParts({ firstName: "Dana", objection, chatUrl, includeRefundOffer: true });
        expect(draftViolations(writtenText(parts)), `${objection}`).toEqual([]);
      }
    }
  });
});

describe("meeting notes in the audit", () => {
  it("adds the notes as the person's own words and reads the objection from them", () => {
    const audit = buildAudit({
      opportunity: opp, stageName: "Qualified", items: [], chats: [], quotes: { asked: null, concern: null }, aiRead: true,
      meetingNotes: "Seed round, hardware investors. Worried about paying before it works.",
    });
    const p = audit.points.find((x) => x.label === "Your meeting notes");
    expect(p?.quote).toBeUndefined();
    expect(p?.sources).toEqual(["Your notes"]);
    expect(audit.objection).toBe("money");
  });
});

describe("suggestAfterMeeting", () => {
  const stages: StageLite[] = [
    { id: "new", name: "New opportunity", sort_order: 0, is_won: false },
    { id: "meet", name: "Meeting", sort_order: 2, is_won: false },
    { id: "prop", name: "Proposal", sort_order: 4, is_won: false },
    { id: "pend", name: "Pending", sort_order: 5, is_won: false },
  ];
  it("suggests Meeting from an earlier stage", () => {
    expect(suggestAfterMeeting(stages, "new").map((m) => m.toStageId)).toEqual(["meet"]);
  });
  it("never moves backward or from a stage the agent is off in", () => {
    expect(suggestAfterMeeting(stages, "prop")).toEqual([]);
    expect(suggestAfterMeeting(stages, "pend")).toEqual([]);
    expect(suggestAfterMeeting(stages, "meet")).toEqual([]);
  });
});
