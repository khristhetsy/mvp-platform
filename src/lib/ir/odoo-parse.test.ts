import { describe, expect, it } from "vitest";
import { attributeEntries, founderPart, groupProjects, inferStage, monthIndex, parseAgentField, parseDate, parseTag, weekIndex } from "./odoo-parse";
import { INTRO_SUBJECT } from "./types";

describe("project names", () => {
  it("reads month ordinals in every spelling", () => {
    expect(monthIndex("Michael Doyle 1st Month")).toBe(1);
    expect(monthIndex("Michael Doyle 2nd-Month")).toBe(2);
    expect(monthIndex("Micheal Doyle-3rd-Month")).toBe(3);
    expect(monthIndex("Paul Miller Month 4")).toBe(4);
    expect(monthIndex("Tyler MacKay")).toBeNull();
    expect(founderPart("Micheal Doyle-3rd-Month")).toBe("Micheal Doyle");
    expect(weekIndex("Michael Doyle Week 22")).toBe(22);
  });
  it("groups a founder's monthly projects and repairs name drift", () => {
    const g = groupProjects([
      { id: 1, name: "Michael Doyle 1st Month", taskCount: 4, dateStart: null, userName: null },
      { id: 3, name: "Micheal Doyle-3rd-Month", taskCount: 4, dateStart: null, userName: null },
      { id: 2, name: "Michael Doyle 2nd-Month", taskCount: 4, dateStart: null, userName: null },
      { id: 9, name: "Pual Miller 1st Month", taskCount: 3, dateStart: null, userName: null },
      { id: 10, name: "Paul Miller 2nd Month", taskCount: 3, dateStart: null, userName: null },
      { id: 11, name: "Paul Miller 3rd Month", taskCount: 3, dateStart: null, userName: null },
    ]);
    expect(g.map((x) => x.founder)).toEqual(["Michael Doyle", "Paul Miller"]);
    expect(g[0].projects.map((p) => p.month)).toEqual([1, 2, 3]);
    expect(g[0].projects.find((p) => p.id === 3)?.nameFixed).toBe(true);
    expect(g[1].projects.find((p) => p.id === 9)?.nameFixed).toBe(true);
    expect(g[0].months).toBe(3);
  });
});

describe("tags", () => {
  it("splits firm and person", () => {
    expect(parseTag("Privos Capital, Dan Farrell")).toMatchObject({ firm: "Privos Capital", name: "Dan Farrell" });
    expect(parseTag("Dan Farrell, Privos Capital")).toMatchObject({ firm: "Privos Capital", name: "Dan Farrell" });
    expect(parseTag("Jeff M. Fettig")).toMatchObject({ firm: null, name: "Jeff M. Fettig" });
    expect(parseTag("Chatham Energy Recovery Group, Inc., Bob")).toMatchObject({ name: "Bob" });
    expect(parseTag("Bob Morris (Chatham Group)")).toMatchObject({ name: "Bob Morris", firm: "Chatham Group" });
    expect(parseTag("dan@privos.com Dan Farrell").email).toBe("dan@privos.com");
  });
});

describe("agent field", () => {
  it("splits pipes into dated, typed activities", () => {
    const e = parseAgentField("Sent intro email 4/22/26 | Called, no answer (1st call) 4/23/26 | Left a voicemail 4/24/26 (edited)");
    expect(e.map((x) => [x.type, x.date])).toEqual([["email", "2026-04-22"], ["call", "2026-04-23"], ["voicemail", "2026-04-24"]]);
    expect(e[0].subject).toBe(INTRO_SUBJECT);
    expect(e[1].outcome).toBe("Called, no answer (1st call)");
  });
  it("flags unreadable dates and keeps investor hints per line", () => {
    const e = parseAgentField("<p>Dan Farrell: Sent intro email last week | Meeting held 5/2/26</p><p>Wallace - Emailed deck 5/3/26</p>");
    expect(e[0].date).toBeNull(); expect(e[0].investorHint).toBe("Dan Farrell");
    expect(e[1].type).toBe("meeting"); expect(e[1].investorHint).toBe("Dan Farrell");
    expect(e[2].investorHint).toBe("Wallace"); expect(e[2].type).toBe("email");
    expect(parseDate("Apr 22, 2026").iso).toBe("2026-04-22"); expect(parseDate("13/45/26").iso).toBeNull();
  });
  it("attributes entries by hint, last name, or sole investor", () => {
    const inv = [{ key: "a", name: "Dan Farrell", firm: "Privos Capital" }, { key: "b", name: "Jonathan Wallace", firm: "BDEV Ventures" }];
    const e = attributeEntries(parseAgentField("Dan Farrell: Sent intro email 4/22/26 | Called 4/23/26\nWallace: Emailed 4/24/26\nNo answer 4/25/26"), inv);
    expect(e.map((x) => x.investorKey)).toEqual(["a", "a", "b", "b"]);
    expect(attributeEntries(parseAgentField("Sent intro email 4/22/26"), [inv[0]])[0].investorKey).toBe("a");
    expect(attributeEntries(parseAgentField("Sent intro email 4/22/26"), inv)[0].investorKey).toBeNull();
  });
  it("infers the stage from the entries", () => {
    const s = (t: string) => inferStage(parseAgentField(t));
    expect(s("Sent intro email 4/22/26")).toBe("intro_sent");
    expect(s("Sent intro email 4/22/26 | Called, no answer 4/23/26 | Left a voicemail 4/24/26")).toBe("intro_sent");
    expect(s("Sent intro email 4/22/26 | Spoke with Dan, interested 4/25/26")).toBe("contacted");
    expect(s("Intro call scheduled for 5/2/26")).toBe("meeting_scheduled");
    expect(s("Meeting held 5/2/26 | Follow up sent 5/4/26")).toBe("follow_up");
    expect(s("Meeting held 5/2/26 | Passed on this round 5/9/26")).toBe("passed");
    expect(s("Term sheet received 9/3/26")).toBe("committed");
  });
});
