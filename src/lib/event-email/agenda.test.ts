import { describe, it, expect } from "vitest";
import {
  buildAgenda,
  exhibitName,
  isExhibitSession,
  leadIndex,
  trimAbstract,
  type Session,
} from "@/lib/event-email/agenda";

const s = (over: Partial<Session> = {}): Session => ({
  id: "sess",
  type: "keynote",
  title: "Auditorium",
  abstract: "",
  accent: "#0D9488",
  ...over,
});

const TALK_SHOW_ABSTRACT =
  "Inside the Investor's Mind – Investor Challenge Series is a monthly, investor-grade talk show designed to reveal how CEOs think, decide, and lead under real-world pressure. Each episode features a candid conversation with a CEO, followed by a live investor panel.";

describe("an abstract becomes one line", () => {
  it("keeps a short first sentence whole", () => {
    expect(trimAbstract("Prequalified deal flow and live Q&A."))
      .toBe("Prequalified deal flow and live Q&A.");
  });

  it("takes only the first sentence when the rest is an essay", () => {
    const out = trimAbstract("A candid conversation with a CEO. Then a live investor panel asks the hard questions.");
    expect(out).toBe("A candid conversation with a CEO.");
  });

  it("caps a first sentence that is itself too long", () => {
    const out = trimAbstract(TALK_SHOW_ABSTRACT);
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out.endsWith("…")).toBe(true);
  });

  it("never cuts mid-word", () => {
    const out = trimAbstract(TALK_SHOW_ABSTRACT);
    const body = out.replace(/…$/, "");
    expect(TALK_SHOW_ABSTRACT.startsWith(body)).toBe(true);
    expect(TALK_SHOW_ABSTRACT[body.length]).toMatch(/\s/);
  });

  it("never leaves dangling punctuation before the ellipsis", () => {
    expect(trimAbstract(`${"word ".repeat(30)}, and more`)).not.toMatch(/[,;:]…$/);
  });

  it("collapses the whitespace the event page allows", () => {
    expect(trimAbstract("  Two   spaces.  ")).toBe("Two spaces.");
  });

  it("returns nothing for an empty abstract, so no empty line renders", () => {
    expect(trimAbstract("")).toBe("");
    expect(trimAbstract("   ")).toBe("");
  });
});

describe("booth sessions masquerading as showcase slots", () => {
  it("recognises the ones in the data", () => {
    expect(isExhibitSession("Exhibitors - NAI Technology")).toBe(true);
    expect(isExhibitSession("Exhibitor – Impervitex Corp")).toBe(true);
    expect(isExhibitSession("Exhibits: Acme")).toBe(true);
  });

  it("does not grab a real session that mentions exhibiting", () => {
    expect(isExhibitSession("How to exhibit well")).toBe(false);
    expect(isExhibitSession("Founder pitches")).toBe(false);
  });

  it("pulls the company out of the title", () => {
    expect(exhibitName("Exhibitors - NAI Technology")).toBe("NAI Technology");
    expect(exhibitName("Exhibitor – Impervitex Corp")).toBe("Impervitex Corp");
  });
});

describe("which session leads", () => {
  it("prefers the talk show — it has a named guest each month", () => {
    const list = [s({ type: "keynote" }), s({ type: "talk_show" }), s({ type: "workshop" })];
    expect(leadIndex(list)).toBe(1);
  });

  it("falls back to the keynote", () => {
    expect(leadIndex([s({ type: "workshop" }), s({ type: "keynote" })])).toBe(1);
  });

  it("leads with nothing when there is only one session", () => {
    expect(leadIndex([s({ type: "talk_show" })])).toBe(-1);
  });

  it("leads with nothing when the only other rows are booths", () => {
    // A feature of one is just a session wearing extra decoration.
    expect(leadIndex([s({ type: "talk_show" }), s({ title: "Exhibitors - NAI" })])).toBe(-1);
  });

  it("never leads with a booth", () => {
    const list = [s({ type: "talk_show", title: "Exhibitors - NAI" }), s({ type: "keynote" }), s({ type: "panel" })];
    expect(list[leadIndex(list)].type).toBe("keynote");
  });
});

describe("the agenda, assembled", () => {
  const list = [
    s({ id: "a", type: "keynote", title: "Auditorium", abstract: "Auditorium: prequalified deal flow. And more." }),
    s({ id: "b", type: "talk_show", title: "Inside the Investor's Mind Vol. 3", abstract: TALK_SHOW_ABSTRACT }),
    s({ id: "c", type: "founder_showcase", title: "Exhibitors - NAI Technology", abstract: "A long company blurb." }),
    s({ id: "d", type: "founder_showcase", title: "Exhibitors - Impervitex Corp", abstract: "Another one." }),
  ];

  it("leads with the talk show", () => {
    expect(buildAgenda(list).lead?.session.id).toBe("b");
  });

  it("puts the rest in rows, without the lead", () => {
    expect(buildAgenda(list).rows.map((r) => r.session.id)).toEqual(["a"]);
  });

  it("merges the booths into one line of company names", () => {
    expect(buildAgenda(list).exhibits).toEqual(["NAI Technology", "Impervitex Corp"]);
  });

  it("trims every abstract it keeps", () => {
    const a = buildAgenda(list);
    expect(a.lead?.abstract.length).toBeLessThanOrEqual(121);
    expect(a.rows[0].abstract).toBe("Auditorium: prequalified deal flow.");
  });

  it("labels a type readably rather than printing the enum", () => {
    expect(buildAgenda(list).lead?.label).toBe("Talk show");
    expect(buildAgenda([s({ type: "founder_showcase" }), s({ type: "keynote" })]).rows[0].label).toBe("Showcase");
  });

  it("copes with an agenda that is only booths", () => {
    const a = buildAgenda([s({ title: "Exhibitors - NAI" })]);
    expect(a.lead).toBeNull();
    expect(a.rows).toEqual([]);
    expect(a.exhibits).toEqual(["NAI"]);
  });
});
