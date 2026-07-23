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

  it("round-trips a band's pill badge and in-band button", () => {
    const band: TemplateBlock = {
      id: "s",
      type: "section",
      eyebrow: "Now live",
      eyebrowBadge: true,
      badgeColor: "#0F6E56",
      heading: "Fresh, vetted, capital-ready.",
      text: "iCapOS is live.",
      buttonLabel: "Browse your matches",
      buttonUrl: "https://icapos.com/m",
      buttonColor: "#5B4BE0",
      bg: "#0c2340",
      color: "#ffffff",
    };
    const html = renderBlocksToEmailHtml([band]);
    expect(html).toContain("border-radius:20px");
    expect(html).toContain("background:#0F6E56");
    expect(html).toContain("https://icapos.com/m");
    const back = parseHtmlToBlocks(html).find((b) => b.type === "section");
    expect(back).toMatchObject({
      eyebrow: "Now live",
      eyebrowBadge: true,
      badgeColor: "#0F6E56",
      heading: "Fresh, vetted, capital-ready.",
      buttonLabel: "Browse your matches",
      buttonUrl: "https://icapos.com/m",
    });
  });

  it("round-trips a band background image over its fallback colour", () => {
    const html = renderBlocksToEmailHtml([
      { id: "s", type: "section", heading: "Hero", text: "Body", bgImage: "https://icapos.com/hero.jpg", bg: "#0c2340", color: "#ffffff" },
    ]);
    expect(html).toContain("hero.jpg");
    expect(html).toContain("background-color:#0c2340");
    const back = parseHtmlToBlocks(html).find((b) => b.type === "section") as { bgImage?: string; bg?: string } | undefined;
    expect(back?.bgImage).toBe("https://icapos.com/hero.jpg");
    expect(back?.bg).toBe("#0c2340");
  });

  it("doesn't invent a badge or button on a plain band", () => {
    const html = renderBlocksToEmailHtml([
      { id: "s", type: "section", eyebrow: "Seasonal", heading: "Raise-ready by fall", text: "Body here.", bg: "#0c2340" },
    ]);
    const back = parseHtmlToBlocks(html).find((b) => b.type === "section") as
      | { eyebrowBadge?: boolean; buttonLabel?: string; heading?: string }
      | undefined;
    expect(back?.eyebrowBadge).toBeUndefined();
    expect(back?.buttonLabel).toBeUndefined();
    expect(back?.heading).toBe("Raise-ready by fall");
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

  it("recovers a callout's eyebrow + heading + body instead of one blob", () => {
    const html = `<table style="border-left:3px solid #0F6E56;background:#f0f7f4;"><tr><td style="padding:14px 16px;">
      <div style="font-weight:bold;text-transform:uppercase;color:#0F6E56;">Scored first</div>
      <div style="font-size:18px;font-weight:bold;color:#1c2434;">Context, not cold decks</div>
      <div style="font-size:15px;color:#5f6b80;">Each founder carries a readiness rating.</div>
    </td></tr></table>`;
    const callout = parseHtmlToBlocks(html).find((b) => b.type === "callout");
    expect(callout).toMatchObject({
      type: "callout",
      eyebrow: "Scored first",
      heading: "Context, not cold decks",
    });
    expect((callout as { text: string }).text).toContain("readiness rating");
    // Round-trips back to email HTML with the eyebrow styled as an uppercase label.
    const out = renderBlocksToEmailHtml([callout!]);
    expect(out).toContain("text-transform:uppercase");
    expect(out).toContain("Context, not cold decks");
  });

  it("round-trips a callout's pill-badge eyebrow", () => {
    const html = renderBlocksToEmailHtml([
      { id: "c", type: "callout", eyebrow: "Scored first", eyebrowBadge: true, badgeColor: "#0F6E56", heading: "Context, not cold decks", text: "Body copy.", borderColor: "#0F6E56" },
    ]);
    expect(html).toContain("border-radius:20px");
    const back = parseHtmlToBlocks(html).find((b) => b.type === "callout");
    expect(back).toMatchObject({ eyebrow: "Scored first", eyebrowBadge: true, heading: "Context, not cold decks" });
  });

  it("leaves a single-line callout as plain text (no invented eyebrow/heading)", () => {
    const html = `<table style="border-left:3px solid #2E78F5;"><tr><td>Most founders go to market too early.</td></tr></table>`;
    const callout = parseHtmlToBlocks(html).find((b) => b.type === "callout") as
      | { eyebrow?: string; heading?: string; text: string }
      | undefined;
    expect(callout?.eyebrow).toBeUndefined();
    expect(callout?.heading).toBeUndefined();
    expect(callout?.text).toContain("go to market too early");
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

describe("text sizing and extended links", () => {
  it("uses an explicit px size on text and headings", () => {
    const html = renderBlocksToEmailHtml([
      { id: "t", type: "text", text: "Body", size: 18 },
      { id: "h", type: "heading", text: "Head", level: 1, size: 32 },
    ]);
    expect(html).toContain("font-size:18px");
    expect(html).toContain("font-size:32px");
  });

  it("falls back to the default size when none is set", () => {
    expect(renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body" }])).toContain("font-size:15px");
  });

  it("clamps absurd sizes rather than emitting them", () => {
    const html = renderBlocksToEmailHtml([
      { id: "a", type: "text", text: "Tiny", size: 2 },
      { id: "b", type: "text", text: "Huge", size: 400 },
    ]);
    expect(html).toContain("font-size:10px");
    expect(html).toContain("font-size:48px");
    expect(html).not.toContain("font-size:400px");
  });

  it("emits literal px, never em or rem", () => {
    const html = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body", size: 20 }]);
    expect(html).not.toMatch(/font-size:[\d.]+r?em/);
  });

  it("applies weight and line height to text blocks", () => {
    const html = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body", bold: true, leading: 2 }]);
    expect(html).toContain("font-weight:bold");
    expect(html).toContain("line-height:2");
  });

  it("clamps line height into a readable range", () => {
    const html = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body", leading: 9 }]);
    expect(html).toContain("line-height:2.4");
  });

  it("links a whole section band", () => {
    const html = renderBlocksToEmailHtml([
      { id: "s", type: "section", heading: "Raise-ready", url: "https://icapos.com/band" },
    ]);
    expect(html).toContain('href="https://icapos.com/band"');
  });

  it("links individual column cells", () => {
    const html = renderBlocksToEmailHtml([
      {
        id: "c",
        type: "columns",
        cells: [
          { title: "For founders", url: "https://icapos.com/f" },
          { title: "For investors", url: "https://icapos.com/i" },
        ],
      },
    ]);
    expect(html).toContain('href="https://icapos.com/f"');
    expect(html).toContain('href="https://icapos.com/i"');
  });

  it("drops unsafe section and column links instead of emitting dead ones", () => {
    const html = renderBlocksToEmailHtml([
      { id: "s", type: "section", heading: "Band", url: "javascript:alert(1)" },
      { id: "c", type: "columns", cells: [{ title: "Cell", url: "javascript:alert(1)" }] },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="#"');
  });

  it("honours custom sizes on callouts, lists, columns, and stats", () => {
    const html = renderBlocksToEmailHtml([
      { id: "c", type: "callout", text: "Note", size: 17 },
      { id: "l", type: "list", items: ["One"], size: 19 },
      { id: "s", type: "stats", items: [{ value: "78", label: "Readiness" }], size: 30 },
    ]);
    expect(html).toContain("font-size:17px");
    expect(html).toContain("font-size:19px");
    expect(html).toContain("font-size:30px");
  });
});

describe("quote, profile, video, social, and signature blocks", () => {
  it("renders a quote with its attribution", () => {
    const html = renderBlocksToEmailHtml([
      { id: "q", type: "quote", text: "It told us what to fix.", attribution: "Founder, Series A" },
    ]);
    expect(html).toContain("It told us what to fix.");
    expect(html).toContain("Founder, Series A");
    expect(html).toContain("font-style:italic");
  });

  it("renders a profile with a circular avatar", () => {
    const html = renderBlocksToEmailHtml([
      { id: "p", type: "profile", name: "Jane Doe", role: "Founder", avatar: "https://cdn.example.com/a.png" },
    ]);
    expect(html).toContain("Jane Doe");
    expect(html).toContain("border-radius:28px");
  });

  it("omits a profile avatar when the URL is unsafe", () => {
    const html = renderBlocksToEmailHtml([
      { id: "p", type: "profile", name: "Jane", avatar: "javascript:alert(1)" },
    ]);
    expect(html).not.toContain("<img");
    expect(html).toContain("Jane");
  });

  it("renders video as a linked poster image, never a video tag", () => {
    const html = renderBlocksToEmailHtml([
      { id: "v", type: "video", thumbnail: "https://cdn.example.com/t.png", url: "https://icapos.com/watch" },
    ]);
    expect(html).not.toContain("<video");
    expect(html).toContain("<img");
    expect(html).toContain('href="https://icapos.com/watch"');
  });

  it("omits a video block with no thumbnail rather than emitting a broken image", () => {
    expect(renderBlocksToEmailHtml([{ id: "v", type: "video", thumbnail: "", url: "https://x.com" }])).not.toContain("<img");
  });

  it("renders social links as text labels, not images", () => {
    const html = renderBlocksToEmailHtml([
      {
        id: "s",
        type: "social",
        links: [
          { network: "linkedin", url: "https://linkedin.com/x" },
          { network: "x", url: "https://x.com/y" },
        ],
      },
    ]);
    expect(html).toContain("LinkedIn");
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://linkedin.com/x"');
  });

  it("drops social links with unsafe URLs", () => {
    const html = renderBlocksToEmailHtml([
      { id: "s", type: "social", links: [{ network: "website", url: "javascript:alert(1)" }] },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Website");
  });

  it("renders a signature with a mailto link", () => {
    const html = renderBlocksToEmailHtml([
      { id: "sg", type: "signature", name: "Khris", title: "CEO", email: "khris@example.com" },
    ]);
    expect(html).toContain("Khris");
    expect(html).toContain('href="mailto:khris@example.com"');
  });

  it("includes the new blocks in the plain-text alternative", () => {
    const text = renderBlocksToText([
      { id: "q", type: "quote", text: "Quoted", attribution: "Someone" },
      { id: "p", type: "profile", name: "Jane Doe", role: "Founder" },
      { id: "v", type: "video", thumbnail: "https://x.com/t.png", url: "https://icapos.com/watch" },
      { id: "sg", type: "signature", name: "Khris", company: "iCFO" },
    ]);
    expect(text).toContain('"Quoted" — Someone');
    expect(text).toContain("Jane Doe");
    expect(text).toContain("https://icapos.com/watch");
    expect(text).toContain("iCFO");
  });
});

describe("theme", () => {
  it("applies font, width, and page colour from the theme", () => {
    const html = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body" }], {
      fontFamily: "Georgia, serif",
      contentWidth: 560,
      pageBg: "#f4f2fe",
    });
    expect(html).toContain("Georgia, serif");
    expect(html).toContain("width:560px");
    expect(html).toContain("background:#f4f2fe");
  });

  it("uses the theme link colour for linked text", () => {
    const html = renderBlocksToEmailHtml(
      [{ id: "t", type: "text", text: "Go", url: "https://icapos.com" }],
      { linkColor: "#0F6E56" },
    );
    expect(html).toContain("color:#0F6E56");
  });

  it("falls back to defaults when no theme is passed", () => {
    const html = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body" }]);
    expect(html).toContain("width:600px");
    expect(html).toContain("Helvetica, Arial, sans-serif");
  });

  it("lets a block override the theme colour", () => {
    const html = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body", color: "#ff0000" }], {
      textColor: "#3a4a63",
    });
    expect(html).toContain("color:#ff0000");
  });
});

describe("per-block styling", () => {
  it("leaves unstyled blocks byte-identical", () => {
    const plain = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body" }]);
    const styled = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body", border: "none" }]);
    expect(styled).toBe(plain);
  });

  it("applies background, radius, and border when set", () => {
    const html = renderBlocksToEmailHtml([
      { id: "t", type: "text", text: "Body", background: "#eef4ff", radius: 12, border: "full", borderColor: "#2E78F5" },
    ]);
    expect(html).toContain("background:#eef4ff");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("border:1px solid #2E78F5");
  });

  it("emits a media query only when a block hides on mobile", () => {
    const without = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body" }]);
    const withHide = renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Body", hideOnMobile: true }]);
    expect(without).not.toContain("@media");
    expect(withHide).toContain("@media only screen and (max-width:600px)");
    expect(withHide).toContain("icapos-hm");
  });
});

describe("stripHtmlToText", () => {
  it("converts breaks and tags to plain text", () => {
    expect(stripHtmlToText("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });
});
