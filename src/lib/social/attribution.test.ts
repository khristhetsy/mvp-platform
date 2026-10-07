import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { channelOf } from "./attribution";

describe("channelOf", () => {
  it("keeps the existing prefixes", () => {
    expect(channelOf("li-post")).toBe("linkedin");
    expect(channelOf("em-q4")).toBe("email");
    expect(channelOf("web-home")).toBe("website");
  });
  it("maps Reddit campaign tags", () => {
    expect(channelOf("rd_ab12cd34")).toBe("reddit");
    expect(channelOf("rd-q4")).toBe("reddit");
  });
  it("leaves generic campaigns and blanks as other", () => {
    expect(channelOf("camp_ab12cd34")).toBe("other");
    expect(channelOf(null)).toBe("other");
  });
});
