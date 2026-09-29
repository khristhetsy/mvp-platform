import { describe, it, expect } from "vitest";
import {
  isTitleTaken,
  nextAvailableTitle,
  normalizeTitle,
  suggestTitle,
  titleKey,
  validateTitle,
} from "@/lib/event-hub/brochure/naming";

const e = (id: string, title: string) => ({ id, title });

describe("what counts as the same name", () => {
  it("ignores case", () => {
    expect(titleKey("Issue 2026")).toBe(titleKey("issue 2026"));
  });

  it("ignores stray whitespace, inside and out", () => {
    expect(titleKey("  Issue   2026 ")).toBe(titleKey("Issue 2026"));
  });

  it("stores the tidied form, not what was typed", () => {
    expect(normalizeTitle("  Las Vegas   — Issue 2026  ")).toBe("Las Vegas — Issue 2026");
  });

  it("keeps genuinely different names apart", () => {
    expect(titleKey("Issue 2026")).not.toBe(titleKey("Issue 2025"));
  });
});

describe("validation", () => {
  it("rejects an empty or whitespace-only name", () => {
    expect(validateTitle("")).toMatch(/name/i);
    expect(validateTitle("   ")).toMatch(/name/i);
  });

  it("rejects something too long to render on a shelf", () => {
    expect(validateTitle("x".repeat(161))).toMatch(/under 160/);
  });

  it("accepts an ordinary name", () => {
    expect(validateTitle("iCFO PE Expo — Las Vegas | Sept 22 — Issue 2026")).toBeNull();
  });
});

describe("the suggested name", () => {
  it("is the event and the year", () => {
    expect(suggestTitle("iCFO PE Expo — Las Vegas | Sept 22", 2026))
      .toBe("iCFO PE Expo — Las Vegas | Sept 22 — Issue 2026");
  });
});

describe("collision detection", () => {
  const existing = [e("a", "Las Vegas — Issue 2026"), e("b", "Newport Beach — Issue 2026")];

  it("finds a duplicate regardless of case and spacing", () => {
    expect(isTitleTaken("las vegas —  Issue 2026", existing)).toBe(true);
  });

  it("lets a booklet keep its own name when renamed", () => {
    expect(isTitleTaken("Las Vegas — Issue 2026", existing, "a")).toBe(false);
  });

  it("still blocks renaming into someone else's name", () => {
    expect(isTitleTaken("Newport Beach — Issue 2026", existing, "a")).toBe(true);
  });

  it("allows a name nobody is using", () => {
    expect(isTitleTaken("Las Vegas — Issue 2027", existing)).toBe(false);
  });
});

describe("suggesting the next free name", () => {
  it("returns the name itself when it is free", () => {
    expect(nextAvailableTitle("Las Vegas — Issue 2026", [])).toBe("Las Vegas — Issue 2026");
  });

  it("appends (2) on the first collision", () => {
    const taken = [e("a", "Las Vegas — Issue 2026")];
    expect(nextAvailableTitle("Las Vegas — Issue 2026", taken)).toBe("Las Vegas — Issue 2026 (2)");
  });

  it("keeps counting past the numbered ones", () => {
    const taken = [
      e("a", "Issue 2026"),
      e("b", "Issue 2026 (2)"),
      e("c", "Issue 2026 (3)"),
    ];
    expect(nextAvailableTitle("Issue 2026", taken)).toBe("Issue 2026 (4)");
  });

  it("does not stack suffixes when cloning an already-numbered booklet", () => {
    const taken = [e("a", "Issue 2026"), e("b", "Issue 2026 (2)")];
    expect(nextAvailableTitle("Issue 2026 (2)", taken)).toBe("Issue 2026 (3)");
  });

  it("tidies the name it returns", () => {
    expect(nextAvailableTitle("  Issue   2026  ", [])).toBe("Issue 2026");
  });
});
