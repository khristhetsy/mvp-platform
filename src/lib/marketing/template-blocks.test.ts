import { describe, it, expect } from "vitest";
import {
  renderBlocksToEmailHtml,
  renderBlocksToText,
  parseHtmlToBlocks,
  seedBlocksFromHtml,
  stripHtmlToText,
  type TemplateBlock,
} from "./template-blocks";

const blocks: TemplateBlock[] = [
  { id: "1", type: "heading", text: "This month's matched founders", level: 1 },
  { id: "2", type: "text", text: "Dear {{first_name}}," },
  { id: "3", type: "button", label: "Open your pipeline", url: "https://icapos.com/pipeline" },
  { id: "4", type: "divider" },
];

describe("renderBlocksToEmailHtml", () => {
  it("produces table-based, inline-styled email HTML", () => {
    const html = renderBlocksToEmailHtml(blocks);
    expect(html).toContain("<table");
    expect(html).toContain('role="presentation"');
    expect(html).toContain("style=");
    // no modern layout that mail clients drop
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("<style");
  });

  it("preserves merge fields verbatim", () => {
    expect(renderBlocksToEmailHtml(blocks)).toContain("{{first_name}}");
  });

  it("escapes user text to prevent injected markup", () => {
    const html = renderBlocksToEmailHtml([
      { id: "x", type: "text", text: '<script>alert("x")</script>' },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralises non-http button URLs", () => {
    const html = renderBlocksToEmailHtml([
      { id: "b", type: "button", label: "Click", url: "javascript:alert(1)" },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("keeps https button URLs", () => {
    expect(renderBlocksToEmailHtml(blocks)).toContain("https://icapos.com/pipeline");
  });

  it("omits image blocks with no source rather than emitting a broken img", () => {
    const html = renderBlocksToEmailHtml([{ id: "i", type: "image", src: "", width: 200 }]);
    expect(html).not.toContain("<img");
  });

  it("omits image blocks with a non-http(s) source", () => {
    const html = renderBlocksToEmailHtml([
      { id: "i", type: "image", src: "javascript:alert(1)", width: 200 },
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
  });

  it("renders uploaded image URLs", () => {
    const html = renderBlocksToEmailHtml([
      { id: "i", type: "image", src: "https://cdn.example.com/a.png", alt: "Logo", width: 180 },
    ]);
    expect(html).toContain('src="https://cdn.example.com/a.png"');
    expect(html).toContain('alt="Logo"');
    expect(html).toContain('width="180"');
  });
});

describe("linked text and heading blocks", () => {
  it("wraps a linked text block in an anchor", () => {
    const html = renderBlocksToEmailHtml([
      { id: "t", type: "text", text: "Read the guide", url: "https://icapos.com/guide" },
    ]);
    expect(html).toContain('href="https://icapos.com/guide"');
    expect(html).toContain("Read the guide</a>");
  });

  it("links headings too", () => {
    const html = renderBlocksToEmailHtml([
      { id: "h", type: "heading", text: "Your score", level: 1, url: "https://icapos.com/score" },
    ]);
    expect(html).toContain('href="https://icapos.com/score"');
  });

  it("renders plain text when the URL is unsafe, never a dead href", () => {
    const html = renderBlocksToEmailHtml([
      { id: "t", type: "text", text: "Click", url: "javascript:alert(1)" },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
    expect(html).toContain("Click");
  });

  it("leaves unlinked blocks untouched", () => {
    expect(renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Plain" }])).not.toContain("<a ");
  });

  it("surfaces the destination in the plain-text alternative", () => {
    const text = renderBlocksToText([
      { id: "t", type: "text", text: "Read the guide", url: "https://icapos.com/guide" },
    ]);
    expect(text).toContain("Read the guide (https://icapos.com/guide)");
  });

  it("recovers a link from a paragraph that is only a link", () => {
    const blocks = parseHtmlToBlocks('<p><a href="https://icapos.com/x">Open your pipeline</a></p>');
    expect(blocks[0]).toMatchObject({ type: "text", text: "Open your pipeline", url: "https://icapos.com/x" });
  });

  it("does not attach a URL when the link is mid-sentence", () => {
    const blocks = parseHtmlToBlocks('<p>Read the <a href="https://x.com">docs</a> first.</p>');
    expect(blocks[0]).not.toHaveProperty("url");
  });
});

describe("renderBlocksToText", () => {
  it("produces a readable plain-text alternative", () => {
    const text = renderBlocksToText(blocks);
    expect(text).toContain("This month's matched founders");
    expect(text).toContain("Open your pipeline: https://icapos.com/pipeline");
  });
});

describe("seedBlocksFromHtml", () => {
  it("keeps paragraphs as separate text blocks", () => {
    const seeded = seedBlocksFromHtml("Welcome", "<p>First para</p><p>Second para</p>");
    expect(seeded.some((b) => b.type === "text" && b.text.includes("First para"))).toBe(true);
    expect(seeded.some((b) => b.type === "text" && b.text.includes("Second para"))).toBe(true);
  });

  it("falls back to the subject heading when the body has no content", () => {
    const seeded = seedBlocksFromHtml("Welcome", "");
    expect(seeded[0]).toMatchObject({ type: "heading", text: "Welcome" });
  });

  it("never returns an empty document", () => {
    expect(seedBlocksFromHtml("", "").length).toBeGreaterThan(0);
  });
});

describe("parseHtmlToBlocks", () => {
  const digest = `
    <table role="presentation" width="600">
      <tr><td align="center"><img src="https://cdn.example.com/logo.png" alt="iCapOS" width="132" /></td></tr>
      <tr><td><h1 style="color:#ffffff;">This month's matched founders</h1></td></tr>
      <tr><td><p>A new cohort has completed their assessment.</p></td></tr>
      <tr><td align="center">
        <a href="https://icapos.com/pipeline" style="background:#5B4BE0;color:#ffffff;display:inline-block;padding:12px 22px;">Open your pipeline</a>
      </td></tr>
      <tr><td><hr /></td></tr>
    </table>`;

  it("preserves headings rather than flattening them to text", () => {
    const blocks = parseHtmlToBlocks(digest);
    expect(blocks).toContainEqual(
      expect.objectContaining({ type: "heading", text: "This month's matched founders" }),
    );
  });

  it("preserves images with their src, alt, and width", () => {
    const img = parseHtmlToBlocks(digest).find((b) => b.type === "image");
    expect(img).toMatchObject({ src: "https://cdn.example.com/logo.png", alt: "iCapOS", width: 132 });
  });

  it("turns styled links into button blocks with their background", () => {
    const btn = parseHtmlToBlocks(digest).find((b) => b.type === "button");
    expect(btn).toMatchObject({
      label: "Open your pipeline",
      url: "https://icapos.com/pipeline",
      bg: "#5B4BE0",
    });
  });

  it("keeps plain inline links as text, not buttons", () => {
    const blocks = parseHtmlToBlocks('<p>Read the <a href="https://x.com">docs</a> first.</p>');
    expect(blocks.every((b) => b.type !== "button")).toBe(true);
    expect(blocks.some((b) => b.type === "text" && b.text.includes("docs"))).toBe(true);
  });

  it("preserves horizontal rules as dividers", () => {
    expect(parseHtmlToBlocks(digest).some((b) => b.type === "divider")).toBe(true);
  });

  it("carries alignment down from the containing cell", () => {
    const blocks = parseHtmlToBlocks('<td align="center"><p>Centered</p></td>');
    expect(blocks.find((b) => b.type === "text")).toMatchObject({ align: "center" });
  });

  it("drops script and style content", () => {
    const blocks = parseHtmlToBlocks("<style>p{color:red}</style><script>alert(1)</script><p>Body</p>");
    const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join(" ");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).toContain("Body");
  });

  it("survives a round trip through the renderer", () => {
    const html = renderBlocksToEmailHtml(parseHtmlToBlocks(digest));
    expect(html).toContain("This month's matched founders");
    expect(html).toContain("https://icapos.com/pipeline");
    expect(html).toContain("https://cdn.example.com/logo.png");
  });
});

describe("section blocks", () => {
  const section: TemplateBlock = {
    id: "s",
    type: "section",
    eyebrow: "Seasonal focus",
    heading: "Raise-ready by fall",
    bg: "#0c2340",
    color: "#ffffff",
  };

  it("renders a coloured band with the heading inside it", () => {
    const html = renderBlocksToEmailHtml([section]);
    expect(html).toContain("background:#0c2340");
    expect(html).toContain("Raise-ready by fall");
    expect(html).toContain("Seasonal focus");
  });

  it("uses tables, not divs, so Outlook honours the background", () => {
    const html = renderBlocksToEmailHtml([section]);
    expect(html).not.toContain("<div");
    expect(html).toContain('role="presentation"');
  });

  it("escapes section text", () => {
    const html = renderBlocksToEmailHtml([{ id: "s", type: "section", heading: "<script>x</script>" }]);
    expect(html).not.toContain("<script>");
  });

  it("recovers a band from HTML as a section, not flattened text", () => {
    const blocks = parseHtmlToBlocks(
      '<table style="background:#0c2340;"><tr><td>Seasonal focus</td></tr><tr><td><h1 style="color:#ffffff;">Raise-ready by fall</h1></td></tr></table>',
    );
    const s = blocks.find((b) => b.type === "section");
    expect(s).toMatchObject({ heading: "Raise-ready by fall", bg: "#0c2340" });
  });

  it("leaves white tables alone rather than making everything a section", () => {
    const blocks = parseHtmlToBlocks('<table style="background:#ffffff;"><tr><td><p>Hi</p></td></tr></table>');
    expect(blocks.every((b) => b.type !== "section")).toBe(true);
  });
});

describe("callout, list, columns, and stats blocks", () => {
  it("renders a callout with its accent border", () => {
    const html = renderBlocksToEmailHtml([
      { id: "c", type: "callout", text: "Most founders go to market too early.", borderColor: "#2E78F5" },
    ]);
    expect(html).toContain("border-left:3px solid #2E78F5");
    expect(html).toContain("Most founders go to market too early.");
  });

  it("renders list items and drops empty ones", () => {
    const html = renderBlocksToEmailHtml([{ id: "l", type: "list", items: ["First", "", "Second"] }]);
    expect(html).toContain("<li");
    expect(html).toContain("First");
    expect(html).toContain("Second");
    expect(html.match(/<li/g)?.length).toBe(2);
  });

  it("renders an ordered list when asked", () => {
    expect(renderBlocksToEmailHtml([{ id: "l", type: "list", items: ["A"], ordered: true }])).toContain("<ol");
  });

  it("lays columns out as table cells with equal widths", () => {
    const html = renderBlocksToEmailHtml([
      { id: "c", type: "columns", cells: [{ title: "For founders" }, { title: "For investors" }] },
    ]);
    expect(html).toContain('width="50%"');
    expect(html).not.toContain("display:flex");
    expect(html).toContain("For founders");
  });

  it("renders stats as a single row of cells", () => {
    const html = renderBlocksToEmailHtml([
      { id: "s", type: "stats", items: [{ value: "78", label: "Readiness" }, { value: "14", label: "Matched" }] },
    ]);
    expect(html).toContain("78");
    expect(html).toContain("Readiness");
    expect(html).toContain('width="50%"');
  });

  it("omits empty list, columns, and stats blocks entirely", () => {
    expect(renderBlocksToEmailHtml([{ id: "l", type: "list", items: [] }])).not.toContain("<li");
    expect(renderBlocksToEmailHtml([{ id: "c", type: "columns", cells: [] }])).not.toContain("<td width");
    expect(renderBlocksToEmailHtml([{ id: "s", type: "stats", items: [] }])).not.toContain("<td width");
  });

  it("recovers a list from HTML instead of flattening it to paragraphs", () => {
    const blocks = parseHtmlToBlocks("<ul><li>Get your score</li><li>Fix the gaps</li></ul>");
    expect(blocks.find((b) => b.type === "list")).toMatchObject({
      items: ["Get your score", "Fix the gaps"],
    });
  });

  it("keeps surrounding text in order around a recovered list", () => {
    const blocks = parseHtmlToBlocks("<p>Before</p><ul><li>Item</li></ul><p>After</p>");
    const types = blocks.map((b) => b.type);
    expect(types.indexOf("list")).toBeGreaterThan(0);
    expect(types.lastIndexOf("text")).toBeGreaterThan(types.indexOf("list"));
  });

  it("includes every new block in the plain-text alternative", () => {
    const text = renderBlocksToText([
      { id: "s", type: "section", heading: "Band heading" },
      { id: "c", type: "callout", text: "Callout copy" },
      { id: "l", type: "list", items: ["One", "Two"] },
      { id: "st", type: "stats", items: [{ value: "78", label: "Readiness" }] },
    ]);
    expect(text).toContain("Band heading");
    expect(text).toContain("Callout copy");
    expect(text).toContain("- One");
    expect(text).toContain("78 Readiness");
  });
});

describe("round trip through render then parse", () => {
  const rich: TemplateBlock[] = [
    { id: "1", type: "section", eyebrow: "Seasonal focus", heading: "Raise-ready by fall", bg: "#0c2340", color: "#ffffff" },
    { id: "2", type: "callout", text: "Most founders go to market too early." },
    { id: "3", type: "list", items: ["Get your score", "Fix the gaps"] },
    { id: "4", type: "stats", items: [{ value: "78", label: "Readiness" }, { value: "14", label: "Matched" }] },
    { id: "5", type: "button", label: "Start now", url: "https://icapos.com" },
  ];

  const roundTrip = () => parseHtmlToBlocks(renderBlocksToEmailHtml(rich)).map((b) => b.type);

  it("keeps sections, callouts, lists, stats, and buttons as themselves", () => {
    const types = roundTrip();
    for (const t of ["section", "callout", "list", "stats", "button"]) {
      expect(types).toContain(t);
    }
  });

  it("does not misread a callout as a section", () => {
    expect(roundTrip().filter((t) => t === "section")).toHaveLength(1);
  });

  it("does not misread tinted column panels as sections", () => {
    const html = renderBlocksToEmailHtml([
      { id: "c", type: "columns", cells: [{ title: "For founders", text: "A" }, { title: "For investors", text: "B" }] },
    ]);
    // Columns don't survive an HTML round trip (documented limitation), but they
    // must degrade to text rather than inventing bogus section bands.
    expect(parseHtmlToBlocks(html).every((b) => b.type !== "section")).toBe(true);
  });

  it("preserves content even where structure degrades", () => {
    const html = renderBlocksToEmailHtml([
      { id: "c", type: "columns", cells: [{ title: "For founders", text: "Know where you stand" }] },
    ]);
    const text = parseHtmlToBlocks(html)
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ");
    expect(text).toContain("For founders");
    expect(text).toContain("Know where you stand");
  });
});

describe("stripHtmlToText", () => {
  it("converts breaks and tags to plain text", () => {
    expect(stripHtmlToText("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });
});
