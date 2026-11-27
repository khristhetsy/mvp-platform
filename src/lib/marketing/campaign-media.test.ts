import { describe, it, expect } from "vitest";
import { safeHttpUrl, mediaBlockHtml, placeMediaAtTop, removeTopAccentLine, ctaButtonHtml, placeCta } from "./campaign-media";

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

const CARD = [
  `<style>.pad{}</style><div style="display:none">Preheader</div>`,
  `<table role="presentation" width="100%" style="background-color:#f3f5f9;"><tr><td align="center" style="padding:28px 12px;">`,
  `<table role="presentation" class="wrap" width="600" style="width:600px;max-width:600px;background-color:#ffffff;">`,
  `<tr><td style="height:5px;line-height:5px;font-size:0;background-color:#0b5cd5;border-radius:10px 10px 0 0;">&nbsp;</td></tr>`,
  `<tr><td class="pad" style="padding:36px 40px 0 40px;"><h1>Headline</h1><p>Lede</p></td></tr>`,
  `<tr><td class="pad" style="padding:20px 40px 0 40px;"><p>Details</p><table><tr><td><p>Nested</p></td></tr></table></td></tr>`,
  `<tr><td class="pad" style="padding:20px 40px 0 40px;"><p>Any questions, reply.</p><p><strong>Khris</strong></p></td></tr>`,
  `<tr><td style="padding:16px 40px;">Footer line</td></tr>`,
  `</table></td></tr></table>`,
].join("");
const IMG = mediaBlockHtml({ imageUrl: "https://cdn.example.com/a.png", imageAlt: "Banner" });
const BTN = ctaButtonHtml({ label: "Talk to our agent", url: "https://icapos.com/acme/agent?src=email" });

describe("removeTopAccentLine", () => {
  it("removes the colored bar above the headline and nothing else", () => {
    const out = removeTopAccentLine(CARD);
    expect(out).not.toContain("#0b5cd5");
    expect(out).toContain("<h1>Headline</h1>");
    expect(out).toContain("Footer line");
    expect(removeTopAccentLine(out)).toBe(out);
  });

  it("leaves spacer rows, white rows and rows below the text alone", () => {
    const spacer = `<table width="600"><tr><td style="height:24px;background-color:#0b5cd5;">&nbsp;</td></tr><tr><td><p>Hi</p></td></tr></table>`;
    const white = `<table width="600"><tr><td style="height:4px;background-color:#ffffff;">&nbsp;</td></tr><tr><td><p>Hi</p></td></tr></table>`;
    const below = `<table width="600"><tr><td><p>Hi</p></td></tr><tr><td style="height:4px;background:#1A6CE4;">&nbsp;</td></tr></table>`;
    expect(removeTopAccentLine(spacer)).toBe(spacer);
    expect(removeTopAccentLine(white)).toBe(white);
    expect(removeTopAccentLine(below)).toBe(below);
    expect(removeTopAccentLine("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});

describe("placeMediaAtTop", () => {
  it("puts the media in the first row of the card, above the headline", () => {
    const out = placeMediaAtTop(removeTopAccentLine(CARD), IMG);
    expect(out.indexOf("a.png")).toBeGreaterThan(out.indexOf('width="600"'));
    expect(out.indexOf("a.png")).toBeLessThan(out.indexOf("<h1>"));
    expect(out).toContain('<tr data-campaign-media="1"><td style="padding:0">');
  });

  it("goes after the tbody a browser adds to the card", () => {
    const out = placeMediaAtTop(`<table width="600"><tbody><tr><td><p>Hi</p></td></tr></tbody></table>`, IMG);
    expect(out).toContain('<tbody><tr data-campaign-media="1">');
  });

  it("replaces the earlier media and removes it for null", () => {
    const first = placeMediaAtTop(CARD, IMG);
    const second = placeMediaAtTop(first, mediaBlockHtml({ videoUrl: "https://youtu.be/abc" }));
    expect(second).not.toContain("a.png");
    expect(second.match(/data-campaign-media/g)).toHaveLength(1);
    expect(placeMediaAtTop(second, null)).toBe(CARD);
  });

  it("sits above a stacked design and above a plain body", () => {
    const stacked = `<div style="display:none">Pre</div><div><div style="margin:0px auto;max-width:600px;"><table><tr><td><p>Hi</p></td></tr></table></div></div>`;
    const out = placeMediaAtTop(stacked, IMG);
    expect(out.indexOf("a.png")).toBeLessThan(out.indexOf("<p>Hi</p>"));
    expect(out).toContain('style="margin:0 auto;max-width:600px"');
    expect(placeMediaAtTop("<p>Hi</p>", IMG).indexOf("a.png")).toBeLessThan(placeMediaAtTop("<p>Hi</p>", IMG).indexOf("<p>Hi</p>"));
  });
});

describe("ctaButtonHtml", () => {
  it("builds an email safe button: table cell color, inline styles, no comments or classes", () => {
    expect(BTN).toContain('bgcolor="#1A6CE4"');
    expect(BTN).toContain('href="https://icapos.com/acme/agent?src=email"');
    expect(BTN).toContain(">Talk to our agent</a>");
    expect(BTN).toContain('role="presentation"');
    expect(BTN).not.toContain("<!--");
    expect(BTN).not.toContain("class=");
  });

  it("returns null without a usable link or a label", () => {
    expect(ctaButtonHtml({ label: "Start", url: "" })).toBeNull();
    expect(ctaButtonHtml({ label: "Start", url: "javascript:alert(1)" })).toBeNull();
    expect(ctaButtonHtml({ label: "  ", url: "https://icapos.com/johnny" })).toBeNull();
  });

  it("escapes a custom label", () => {
    expect(ctaButtonHtml({ label: '<b>Go" now</b>', url: "https://icapos.com/johnny" })).toContain("&lt;b&gt;Go&quot; now&lt;/b&gt;");
  });
});

describe("placeCta", () => {
  it("puts the button after the body text and above the closing row of a card", () => {
    const out = placeCta(CARD, BTN);
    expect(out.indexOf("Talk to our agent")).toBeGreaterThan(out.indexOf("Nested"));
    expect(out.indexOf("Talk to our agent")).toBeLessThan(out.indexOf("Any questions"));
    expect(out).toContain('<tr data-campaign-cta="1"><td class="pad" style="padding:12px 40px 20px 40px">');
  });

  it("replaces the earlier button, also after a browser adds tbody, and removes it for null", () => {
    const first = placeCta(CARD, BTN);
    const browser = first.replace("<tr><td align=\"center\" bgcolor", "<tbody><tr><td align=\"center\" bgcolor").replace("</a></td></tr></table>", "</a></td></tr></tbody></table>");
    const second = placeCta(browser, ctaButtonHtml({ label: "Start", url: "https://icapos.com/johnny?src=email" }));
    expect(second.match(/data-campaign-cta/g)).toHaveLength(1);
    expect(second).toContain(">Start</a>");
    expect(second).not.toContain("Talk to our agent");
    expect(placeCta(second, null)).toBe(CARD);
  });

  it("ignores the media row when it looks for the body text", () => {
    const out = placeCta(placeMediaAtTop(CARD, IMG), BTN);
    expect(out.indexOf("a.png")).toBeLessThan(out.indexOf("<h1>"));
    expect(out.indexOf("Talk to our agent")).toBeLessThan(out.indexOf("Any questions"));
    expect(out.indexOf("Talk to our agent")).toBeGreaterThan(out.indexOf("Nested"));
  });

  it("follows the first paragraph of text in a card built from plain cells", () => {
    const long = "We are writing to let you know that billing is moving, and what it means for your account.";
    const out = placeCta(`<table width="600"><tr><td style="padding:8px 24px;">Headline</td></tr><tr><td style="padding:8px 24px;">${long}</td></tr><tr><td>Footer</td></tr></table>`, BTN);
    expect(out.indexOf("Talk to our agent")).toBeGreaterThan(out.indexOf(long));
    expect(out.indexOf("Talk to our agent")).toBeLessThan(out.indexOf("Footer"));
    expect(out).toContain('style="padding:12px 24px 20px 24px"');
  });

  it("follows the last paragraph outside a card", () => {
    const out = placeCta(`<div><p>One</p><p>Two</p></div><div>Footer</div>`, BTN);
    expect(out.indexOf("Talk to our agent")).toBeGreaterThan(out.indexOf("Two"));
    expect(out.indexOf("Talk to our agent")).toBeLessThan(out.indexOf("Footer"));
    expect(placeCta("Plain text", BTN).startsWith("Plain text<div")).toBe(true);
  });
});
