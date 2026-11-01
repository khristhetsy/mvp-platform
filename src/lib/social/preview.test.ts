import { describe, expect, it } from "vitest";
import { previewParts } from "./preview";

describe("previewParts", () => {
  it("uses the first line as the Reddit title", () => {
    const p = previewParts("reddit", "Raising a seed round\nDetails here", false);
    expect(p.title).toBe("Raising a seed round");
    expect(p.text).toBe("Details here");
  });
  it("keeps the body whole on LinkedIn and reports the network limit", () => {
    const p = previewParts("linkedin", "Hello", true);
    expect(p.title).toBeNull();
    expect(p.text).toBe("Hello");
    expect(p.limit).toBe(3000);
    expect(p.note).toMatch(/first comment/);
  });
  it("says Instagram needs an image", () => {
    expect(previewParts("instagram", "Hi", false).note).toMatch(/image/);
  });
});
