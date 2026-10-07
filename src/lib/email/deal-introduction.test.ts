import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mergeSlots } from "./template-merge";
import { renderCopyHtml } from "./render-copy";
import { validateMasterAgainstSchema, type PlaceholderSchema } from "./template-schema";
import manifest from "./templates/manifest.json";
import type { CopyWithMaster } from "./masters-queries";

const schema = (manifest.masters.find((m) => m.slug === "deal-introduction")!.schema) as PlaceholderSchema;
const mjml = readFileSync(join(__dirname, "templates/deal-introduction.mjml"), "utf8");

describe("deal introduction master", () => {
  it("passes the build guardrails", () => {
    expect(validateMasterAgainstSchema(mjml, schema)).toEqual({ ok: true, errors: [] });
  });

  it("carries the iCFO disclaimer", () => {
    expect(mjml).toContain("does not solicit securities and is not an investment adviser");
    expect(mjml).toContain("for educational purposes only");
  });
});

describe("rich slot types", () => {
  const s: PlaceholderSchema = {
    slots: [
      { key: "body", type: "richtext", label: "b" },
      { key: "items", type: "list", label: "l" },
      { key: "terms", type: "terms", label: "t" },
    ],
    locked: [],
  };

  it("renders paragraphs and bold, escaping markup", () => {
    const html = mergeSlots("{{body}}", { body: "One **two** <x>\n\nThree" }, s);
    expect(html).toContain("<b>two</b>");
    expect(html).toContain("&lt;x&gt;");
    expect(html.match(/<p /g)?.length).toBe(2);
  });

  it("renders one bullet per line and drops marker characters", () => {
    const html = mergeSlots("{{items}}", { items: "- **A** first\n• second\n\n" }, s);
    expect(html.match(/<li /g)?.length).toBe(2);
    expect(html).toContain("<b>A</b> first");
  });

  it("renders Label: value lines as tiles, 3 per row", () => {
    const html = mergeSlots("{{terms}}", { terms: "Raise: $2M\nInterest: 10%\nMaturity: 2 years\nWarrant coverage: 30%" }, s);
    expect(html.match(/<tr>/g)?.length).toBe(2);
    expect(html).toContain("Warrant coverage");
    expect(html).toContain("$2M");
  });
});

describe("optional blocks", () => {
  const s: PlaceholderSchema = { slots: [{ key: "bio", type: "textarea", label: "Bio" }], locked: [] };
  it("removes a block when its slot is empty and keeps it when filled", () => {
    const tpl = "A<!--if:bio--><i>{{bio}}</i><!--endif:bio-->B";
    expect(mergeSlots(tpl, { bio: "" }, s)).toBe("AB");
    expect(mergeSlots(tpl, { bio: "Hi" }, s)).toBe("A<i>Hi</i>B");
  });
  it("keeps a block whose key is a preserved send token", () => {
    const tpl = "<!--if:unsubscribe_url--><a href=\"{{unsubscribe_url}}\">U</a><!--endif:unsubscribe_url-->";
    expect(mergeSlots(tpl, {}, s, { preserveTokens: ["unsubscribe_url"] })).toContain("{{unsubscribe_url}}");
  });
});

describe("campaign render", () => {
  const c = {
    id: "c",
    master_id: "m",
    name: "HoloMD",
    slot_values: { greeting: "Hi {{first_name}}," },
    banner_mode: "gradient",
    banner_image_url: null,
    footer_note: null,
    status: "draft",
    campaign_group_id: null,
    created_by: "u",
    created_at: "",
    updated_at: "",
    master: {
      id: "m",
      name: "Deal introduction",
      compiled_html:
        "<p>Hi {{first_name}},</p><!--if:unsubscribe_url--><a href=\"{{unsubscribe_url}}\">Unsubscribe</a><!--endif:unsubscribe_url-->",
      placeholder_schema: schema,
    },
  } as unknown as CopyWithMaster;

  it("drops the master unsubscribe line and keeps recipient tokens", () => {
    const html = renderCopyHtml(c, "campaign");
    expect(html).not.toContain("Unsubscribe");
    expect(html).toContain("{{first_name}}");
  });
});

describe("condensed email", () => {
  const html =
    "<!--if:overview_url--><a href='{{overview_url}}'>more</a><!--endif:overview_url-->{{body}}|{{considerations}}|{{terms}}|{{cta_intro}}|{{sender_bio}}";
  const base = {
    body: "First para.\n\nSecond para.",
    considerations: "a\nb\nc\nd",
    terms: "Raise: $2M",
    cta_intro: "Let's talk.",
    sender_bio: "Bio here.",
  };
  const mk = (values: Record<string, string>) =>
    ({
      id: "7f734b75-ac4a-43c0-ae63-016bc3897794",
      slot_values: values,
      banner_mode: "gradient",
      master: { compiled_html: html, placeholder_schema: schema },
    }) as unknown as CopyWithMaster;

  it("defaults to the short form with the overview link", () => {
    const out = renderCopyHtml(mk(base), "send");
    expect(out).toContain("/e/overview/7f734b75-ac4a-43c0-ae63-016bc3897794");
    expect(out).toContain("First para.");
    expect(out).not.toContain("Second para.");
    expect(out.match(/<li /g)?.length).toBe(3);
    expect(out).toContain("$2M");
    expect(out).not.toContain("Let&#39;s talk.");
    expect(out).not.toContain("Let's talk.");
    expect(out).not.toContain("Bio here.");
  });

  it("shows everything and drops the link when every option is Full or Show", () => {
    const out = renderCopyHtml(
      mk({ ...base, view_body: "full", view_considerations: "full", view_sender_bio: "full" }),
      "send",
    );
    expect(out).not.toContain("/e/overview/");
    expect(out).toContain("Second para.");
    expect(out.match(/<li /g)?.length).toBe(4);
    expect(out).toContain("Let's talk.");
    expect(out).toContain("Bio here.");
  });

  it("hides terms only when asked", () => {
    const out = renderCopyHtml(mk({ ...base, view_terms: "short" }), "send");
    expect(out).not.toContain("$2M");
  });
});

describe("nested optional blocks", () => {
  const s: PlaceholderSchema = {
    slots: [
      { key: "a", type: "text", label: "a" },
      { key: "b", type: "text", label: "b" },
    ],
    locked: [],
  };
  const tpl = "<!--if:a-->{{a}}<!--endif:a--><!--if:a--><!--if:b--> · <!--endif:b--><!--endif:a--><!--if:b-->{{b}}<!--endif:b-->";
  it("adds the separator only when both sides are filled", () => {
    expect(mergeSlots(tpl, { a: "1", b: "2" }, s)).toBe("1 · 2");
    expect(mergeSlots(tpl, { a: "", b: "2" }, s)).toBe("2");
    expect(mergeSlots(tpl, { a: "1", b: "" }, s)).toBe("1");
  });
});
