import { describe, expect, it } from "vitest";
import { buildPreviewDoc, findPlaceholders, sendNotes } from "@/lib/email-preview";

describe("buildPreviewDoc", () => {
  it("shows a full HTML document as written", () => {
    const doc = '<!DOCTYPE html><html><body style="background:#eef2f9"><p>Hi</p></body></html>';
    expect(buildPreviewDoc(doc)).toBe(doc);
  });

  it("wraps a fragment in a plain page", () => {
    const out = buildPreviewDoc("<p>Hi</p>");
    expect(out.startsWith("<!doctype html>")).toBe(true);
    expect(out).toContain("<p>Hi</p>");
  });

  it("treats an html tag with attributes as a full document", () => {
    const doc = '<html lang="en"><body>x</body></html>';
    expect(buildPreviewDoc(doc)).toBe(doc);
  });
});

describe("findPlaceholders", () => {
  it("finds leftover bracket placeholders once each", () => {
    const html = '<a href="[UNSUBSCRIBE LINK]">x</a> <img src="[BANNER IMAGE LINK]"> [UNSUBSCRIBE LINK] Hi [First name]';
    expect(findPlaceholders(html)).toEqual(["[UNSUBSCRIBE LINK]", "[BANNER IMAGE LINK]", "[First name]"]);
  });

  it("ignores merge tags and ordinary brackets", () => {
    expect(findPlaceholders("Hi {{first_name}}, see [1] and [link]")).toEqual([]);
  });
});

describe("sendNotes", () => {
  it("gives no notes for an empty body", () => {
    expect(sendNotes("   ", "")).toEqual([]);
  });

  it("flags an empty subject", () => {
    expect(sendNotes("<p>Hi</p>", "  ")).toEqual(["The Subject is empty."]);
  });

  it("flags a placeholder left in the body", () => {
    expect(sendNotes('<a href="[UNSUBSCRIBE LINK]">x</a>', "Now on mobile")).toEqual([
      "Still has a placeholder to replace: [UNSUBSCRIBE LINK].",
    ]);
  });

  it("gives no notes when the subject is set and nothing is left over", () => {
    expect(sendNotes("<p>Hi {{first_name}}</p>", "Now on mobile")).toEqual([]);
  });
});
