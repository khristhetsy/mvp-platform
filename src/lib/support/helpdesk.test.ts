import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { DEFAULT_GUIDES, mergeGuides, pickGuide } from "./guides";
import { plainFromEmail, requestIdFromToken, stripQuotedReply } from "./inbound";
import { supportChannel } from "./support";

describe("support guides", () => {
  it("picks the guide for the tool the founder asked from", () => {
    expect(pickGuide(DEFAULT_GUIDES, "Cap table", null).topic).toBe("Cap table");
  });
  it("falls back to the AI triage topic, then General", () => {
    expect(pickGuide(DEFAULT_GUIDES, "Support", "Billing").topic).toBe("Billing");
    expect(pickGuide(DEFAULT_GUIDES, null, "Something else entirely").topic).toBe("General");
  });
  it("lets a saved guide replace the default for the same topic", () => {
    const merged = mergeGuides([{ topic: "billing", title: "Billing", steps: ["One"] }]);
    expect(pickGuide(merged, "Billing", null).steps).toEqual(["One"]);
    expect(merged.length).toBe(DEFAULT_GUIDES.length);
  });
});

describe("support by email", () => {
  it("reads the request id back from a reply token", () => {
    expect(requestIdFromToken("sup0123456789abcdef0123456789abcdef")).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(requestIdFromToken("abc123")).toBeNull();
  });
  it("keeps only the new text of an email reply", () => {
    const text = "Thanks, that worked.\n\nOn Tue, Oct 6, 2026 at 9:00 AM iCapOS <support@icapos.com> wrote:\n> Earlier message";
    expect(stripQuotedReply(text)).toBe("Thanks, that worked.");
    expect(plainFromEmail(null, "<p>Hello</p><p>Second</p>")).toBe("Hello\n\n Second");
  });
});

describe("support channel", () => {
  it("maps request sources to help desk channels", () => {
    expect(supportChannel({ source: "email", context_item: null })).toBe("email");
    expect(supportChannel({ source: "chat", context_item: null })).toBe("chat");
    expect(supportChannel({ source: "request_help", context_item: "Assistant" })).toBe("chat");
    expect(supportChannel({ source: "request_help", context_item: "Cap table" })).toBe("app");
  });
});
