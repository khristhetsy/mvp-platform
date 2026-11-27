import { describe, it, expect } from "vitest";
import { safeHttpUrl, mediaBlockHtml, appendMedia } from "./campaign-media";

describe("safeHttpUrl", () => {
  it("accepts http and https links only", () => {
    expect(safeHttpUrl(" https://example.com/v.mp4 ")).toBe("https://example.com/v.mp4");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe("mediaBlockHtml", () => {
  it("returns null with nothing usable", () => {
    expect(mediaBlockHtml({})).toBeNull();
    expect(mediaBlockHtml({ imageUrl: "javascript:x", videoUrl: "ftp://x" })).toBeNull();
  });

  it("builds an image block", () => {
    const html = mediaBlockHtml({ imageUrl: "https://cdn.example.com/a.png", imageAlt: "Banner" });
    expect(html).toContain('src="https://cdn.example.com/a.png"');
    expect(html).toContain('alt="Banner"');
    expect(html).not.toContain("<a ");
  });

  it("builds a video link with the image as its thumbnail", () => {
    const html = mediaBlockHtml({ imageUrl: "https://cdn.example.com/t.png", videoUrl: "https://youtu.be/abc" });
    expect(html).toContain('href="https://youtu.be/abc"');
    expect(html).toContain("<img");
    expect(html).toContain("Watch the video");
  });

  it("builds a button when the video has no thumbnail", () => {
    const html = mediaBlockHtml({ videoUrl: "https://youtu.be/abc" });
    expect(html).toContain("Watch the video");
    expect(html).not.toContain("<img");
  });

  it("escapes quotes in alt text and urls", () => {
    const html = mediaBlockHtml({ imageUrl: "https://cdn.example.com/a.png", imageAlt: 'x" onerror="y' }) ?? "";
    expect(html).not.toContain('onerror="y"');
    expect(html).toContain("&quot;");
  });
});

describe("appendMedia", () => {
  it("appends the block and leaves the body alone for null", () => {
    expect(appendMedia("<p>Hi</p>", "<p>B</p>")).toBe("<p>Hi</p><p>B</p>");
    expect(appendMedia("<p>Hi</p>", null)).toBe("<p>Hi</p>");
  });
});
