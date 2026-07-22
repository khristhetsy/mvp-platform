import { describe, it, expect } from "vitest";
import {
  extractTokens,
  validateMasterAgainstSchema,
  type PlaceholderSchema,
} from "./template-schema";

const schema: PlaceholderSchema = {
  slots: [
    { key: "headline", type: "text", label: "Headline", required: true },
    { key: "body", type: "textarea", label: "Body", required: true },
    { key: "cta_text", type: "text", label: "CTA text", required: true },
    { key: "cta_url", type: "url", label: "CTA link", required: true },
    { key: "banner_image", type: "image", label: "Banner", editable: true, required: false },
  ],
  locked: ["logo", "brand_colors", "footer_legal", "unsubscribe"],
};

// A minimal well-formed master: every required slot appears, footer present.
const goodMjml = `
  <mj-text>{{headline}}</mj-text>
  <mj-text>{{body}}</mj-text>
  <mj-button href="{{cta_url}}">{{cta_text}}</mj-button>
  <mj-image src="{{banner_image}}" />
  <mj-text><a href="{{unsubscribe_url}}">Unsubscribe</a></mj-text>
`;

describe("extractTokens", () => {
  it("finds every distinct token, case-insensitively and with loose spacing", () => {
    expect(extractTokens("{{a}} {{ b }} {{A}}").sort()).toEqual(["a", "b"]);
  });
});

describe("validateMasterAgainstSchema", () => {
  it("accepts a master whose tokens all map to slots + the footer", () => {
    expect(validateMasterAgainstSchema(goodMjml, schema)).toEqual({ ok: true, errors: [] });
  });

  it("rejects an unknown token that no slot defines", () => {
    const result = validateMasterAgainstSchema(goodMjml + "{{mystery}}", schema);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("mystery");
  });

  it("allows send-time tokens without a slot (first_name, view_in_browser_url)", () => {
    const withSendTokens = goodMjml + "{{first_name}} {{view_in_browser_url}}";
    expect(validateMasterAgainstSchema(withSendTokens, schema).ok).toBe(true);
  });

  it("fails the build when the mandatory unsubscribe token is missing", () => {
    const noFooter = goodMjml.replace("{{unsubscribe_url}}", "#");
    const result = validateMasterAgainstSchema(noFooter, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unsubscribe_url");
  });

  it("flags a required slot that never appears in the template", () => {
    const missingBody = goodMjml.replace("{{body}}", "");
    const result = validateMasterAgainstSchema(missingBody, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("body");
  });

  it("reports every problem at once, not just the first", () => {
    const broken = "{{headline}} {{unknown_one}} {{unknown_two}}"; // missing footer + required slots + 2 unknowns
    const result = validateMasterAgainstSchema(broken, schema);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
