import { describe, it, expect, afterEach } from "vitest";
import { taggedLink, trackedLink } from "./queue";

const ORIG = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => { process.env.NEXT_PUBLIC_APP_URL = ORIG; });

describe("taggedLink", () => {
  it("appends ?s= when absent, leaves existing", () => {
    expect(taggedLink("https://icapos.com/fit", "camp_ab12")).toBe("https://icapos.com/fit?s=camp_ab12");
    expect(taggedLink("https://icapos.com/fit?s=keep", "camp_ab12")).toBe("https://icapos.com/fit?s=keep");
  });
  it("no-ops without url or tag", () => {
    expect(taggedLink(null, "camp")).toBeNull();
    expect(taggedLink("https://x.com", null)).toBe("https://x.com");
  });
});

describe("trackedLink", () => {
  it("routes through /r/<post> when app url + post id present", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://icapos.com/";
    expect(trackedLink("11111111-1111-1111-1111-111111111111", "https://icapos.com/fit", "camp_ab12"))
      .toBe("https://icapos.com/r/11111111-1111-1111-1111-111111111111");
  });
  it("falls back to the direct tagged link without a post id", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://icapos.com";
    expect(trackedLink(null, "https://icapos.com/fit", "camp_ab12")).toBe("https://icapos.com/fit?s=camp_ab12");
  });
  it("falls back to tagged link when app url is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(trackedLink("11111111-1111-1111-1111-111111111111", "https://icapos.com/fit", "camp_ab12"))
      .toBe("https://icapos.com/fit?s=camp_ab12");
  });
  it("returns null when there is no link", () => {
    expect(trackedLink("id", null, "camp")).toBeNull();
  });
});
