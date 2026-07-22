import { describe, it, expect } from "vitest";
import { renderCopyHtml } from "./render-copy";
import type { CopyWithMaster } from "./masters-queries";

function copy(overrides: Partial<CopyWithMaster> = {}): CopyWithMaster {
  return {
    id: "c1",
    master_id: "m1",
    name: "Announcement — Copy",
    slot_values: { headline: "Q4 is live", cta_url: "https://icapos.com/x", cta_text: "Read more" },
    banner_mode: "gradient",
    banner_image_url: null,
    footer_note: null,
    status: "draft",
    campaign_group_id: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    master: {
      id: "m1",
      name: "Announcement",
      compiled_html:
        '<div style="background-image:url({{banner_image}})"><h1>{{headline}}</h1></div>' +
        '<a href="{{cta_url}}">{{cta_text}}</a>' +
        '<a href="{{unsubscribe_url}}">Unsubscribe</a>',
      placeholder_schema: {
        slots: [
          { key: "headline", type: "text", label: "Headline" },
          { key: "cta_text", type: "text", label: "CTA" },
          { key: "cta_url", type: "url", label: "CTA link" },
          { key: "banner_image", type: "image", label: "Banner" },
        ],
        locked: [],
      },
    },
    ...overrides,
  };
}

describe("renderCopyHtml", () => {
  it("merges slot values into the master HTML", () => {
    const html = renderCopyHtml(copy(), "preview");
    expect(html).toContain("Q4 is live");
    expect(html).toContain("https://icapos.com/x");
  });

  it("preserves send tokens for the send layer in send mode", () => {
    expect(renderCopyHtml(copy(), "send")).toContain("{{unsubscribe_url}}");
  });

  it("fills send tokens with a safe placeholder in preview mode (never raw braces)", () => {
    const html = renderCopyHtml(copy(), "preview");
    expect(html).not.toContain("{{unsubscribe_url}}");
    expect(html).toContain('href="#"');
  });

  it("gradient banner mode leaves the banner image empty (gradient only)", () => {
    const html = renderCopyHtml(copy({ banner_mode: "gradient" }), "preview");
    expect(html).toContain("background-image:url()");
  });

  it("image banner mode injects the chosen image", () => {
    const html = renderCopyHtml(
      copy({ banner_mode: "image", banner_image_url: "https://cdn.example.com/b.png" }),
      "preview",
    );
    expect(html).toContain("https://cdn.example.com/b.png");
  });

  it("sanitises an unsafe banner URL", () => {
    const html = renderCopyHtml(copy({ banner_mode: "image", banner_image_url: "javascript:alert(1)" }), "send");
    expect(html).not.toContain("javascript:");
  });
});
