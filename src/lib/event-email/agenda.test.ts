import { describe, it, expect } from "vitest";
import {
  buildAgenda,
  exhibitName,
  isExhibitSession,
  orderSessions,
  trimAbstract,
  type Session,
} from "@/lib/event-email/agenda";

const s = (over: Partial<Session> = {}): Session => ({
  id: "sess",
  type: "keynote",
  title: "Auditorium",
  abstract: "",
  accent: "#185FA5",
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

describe("the order an agenda is read in", () => {
  it("opens with the keynote, then the talk show", () => {
    const list = [s({ type: "workshop" }), s({ type: "talk_show" }), s({ type: "keynote" })];
    expect(orderSessions(list).map((x) => x.type)).toEqual(["keynote", "talk_show", "workshop"]);
  });

  it("keeps the given order within one kind, so admin reordering still works", () => {
    const list = [s({ type: "panel", title: "B" }), s({ type: "panel", title: "A" })];
    expect(orderSessions(list).map((x) => x.title)).toEqual(["B", "A"]);
  });

  it("puts an unknown type last rather than dropping it", () => {
    const list = [s({ type: "fireside" }), s({ type: "keynote" })];
    expect(orderSessions(list).map((x) => x.type)).toEqual(["keynote", "fireside"]);
  });

  it("does not need a keynote to be present", () => {
    const list = [s({ type: "panel" }), s({ type: "talk_show" })];
    expect(orderSessions(list).map((x) => x.type)).toEqual(["talk_show", "panel"]);
  });
});

describe("the agenda, assembled", () => {
  const list = [
    s({ id: "a", type: "keynote", title: "Auditorium", abstract: "Auditorium: prequalified deal flow. And more." }),
    s({ id: "b", type: "talk_show", title: "Inside the Investor's Mind Vol. 3", abstract: TALK_SHOW_ABSTRACT }),
    s({ id: "c", type: "founder_showcase", title: "Exhibitors - NAI Technology", abstract: "A long company blurb." }),
    s({ id: "d", type: "founder_showcase", title: "Exhibitors - Impervitex Corp", abstract: "Another one." }),
  ];

  it("puts the keynote before the talk show, whatever order they arrived in", () => {
    expect(buildAgenda(list).rows.map((r) => r.session.id)).toEqual(["a", "b"]);
  });

  it("features nothing — every session is an equal row", () => {
    expect(buildAgenda(list).rows.every((r) => r.weight === "programmed")).toBe(true);
  });

  it("merges the booths into one line of company names", () => {
    expect(buildAgenda(list).exhibits).toEqual(["NAI Technology", "Impervitex Corp"]);
  });

  it("trims every abstract it keeps", () => {
    const a = buildAgenda(list);
    expect(a.rows[0].abstract).toBe("Auditorium: prequalified deal flow.");
    expect(a.rows[1].abstract.length).toBeLessThanOrEqual(121);
  });

  it("labels a type readably rather than printing the enum", () => {
    expect(buildAgenda(list).rows[1].label).toBe("Talk show");
    // Keynote sorts first now, so the showcase is the second row.
    expect(buildAgenda([s({ type: "founder_showcase" }), s({ type: "keynote" })]).rows[1].label).toBe("Showcase");
  });

  it("copes with an agenda that is only booths", () => {
    const a = buildAgenda([s({ title: "Exhibitors - NAI" })]);
    expect(a.rows).toEqual([]);
    expect(a.exhibits).toEqual(["NAI"]);
  });
});
