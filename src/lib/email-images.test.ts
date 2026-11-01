import { describe, expect, it } from "vitest";
import { BANNER_END, BANNER_START, applyBanner, buildBannerTag, hasBanner } from "@/lib/email-images";

const URL_A = "https://example.supabase.co/storage/v1/object/public/marketing-assets/email/2026/a.jpg";
const URL_B = "https://example.supabase.co/storage/v1/object/public/marketing-assets/email/2026/b.jpg";

const tableEmail = `<!DOCTYPE html><html><body style="margin:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td>Headline</td></tr>
</table></td></tr></table></body></html>`;

const count = (s: string, part: string) => s.split(part).length - 1;

describe("applyBanner", () => {
  it("adds the banner as the first row of the outer 600 px table", () => {
    const out = applyBanner(tableEmail, URL_A, "Banner A");
    expect(hasBanner(out)).toBe(true);
    expect(count(out, "<img")).toBe(1);
    const tableAt = out.indexOf('width="600" cellpadding');
    expect(out.indexOf(BANNER_START)).toBeGreaterThan(tableAt);
    expect(out.indexOf(BANNER_START)).toBeLessThan(out.indexOf("Headline"));
    expect(out).toContain("<tr><td><img");
  });

  it("replaces only what sits between the markers when a banner exists", () => {
    const first = applyBanner(tableEmail, URL_A, "Banner A");
    const second = applyBanner(first, URL_B, "Banner B");
    expect(count(second, BANNER_START)).toBe(1);
    expect(count(second, BANNER_END)).toBe(1);
    expect(count(second, "<img")).toBe(1);
    expect(second).toContain(URL_B);
    expect(second).not.toContain(URL_A);
    expect(second.replace(/<!--ICAPOS_BANNER_START-->[\s\S]*<!--ICAPOS_BANNER_END-->/, "")).toBe(
      first.replace(/<!--ICAPOS_BANNER_START-->[\s\S]*<!--ICAPOS_BANNER_END-->/, ""),
    );
  });

  it("stays one banner after picking three times", () => {
    let html = tableEmail;
    for (const [u, a] of [[URL_A, "a"], [URL_B, "b"], [URL_A, "c"]]) html = applyBanner(html, u, a);
    expect(count(html, "<img")).toBe(1);
    expect(html).toContain('alt="c"');
  });

  it("keeps a plain image (no row) when the existing block is not a table row", () => {
    const plain = `${BANNER_START}\n${buildBannerTag(URL_A, "old")}\n${BANNER_END}<p>Hello</p>`;
    const out = applyBanner(plain, URL_B, "new");
    expect(out).not.toContain("<tr>");
    expect(out).toContain(URL_B);
    expect(out.endsWith("<p>Hello</p>")).toBe(true);
  });

  it("goes first in the body when there is no 600 px table", () => {
    const out = applyBanner("<html><body><p>Hi</p></body></html>", URL_A, "A");
    expect(out.indexOf(BANNER_START)).toBeGreaterThan(out.indexOf("<body>"));
    expect(out.indexOf(BANNER_START)).toBeLessThan(out.indexOf("<p>Hi</p>"));
    expect(out).not.toContain("<tr>");
  });

  it("goes first when the body is a bare fragment, and works on an empty body", () => {
    expect(applyBanner("<p>Hi</p>", URL_A, "A").startsWith(BANNER_START)).toBe(true);
    const empty = applyBanner("", URL_A, "A");
    expect(hasBanner(empty)).toBe(true);
    expect(count(empty, "<img")).toBe(1);
  });

  it("ignores the cursor: the banner never lands in the middle of the body", () => {
    const out = applyBanner("<p>Hello</p><p>World</p>", URL_A, "A");
    expect(out.indexOf(BANNER_START)).toBe(0);
  });

  it("treats a start marker with no end marker as no banner", () => {
    const broken = `${BANNER_START}<p>Hello</p>`;
    expect(hasBanner(broken)).toBe(false);
  });

  it("escapes the alt text and URL", () => {
    const out = applyBanner("<p>x</p>", URL_A, 'He said "hi" <b>');
    expect(out).toContain("&quot;hi&quot;");
    expect(out).toContain("&lt;b&gt;");
  });

  it("sizes the banner to the full card width", () => {
    const tag = buildBannerTag(URL_A, "A");
    expect(tag).toContain('width="600"');
    expect(tag).toContain("width:100%");
    expect(tag).toContain("max-width:600px");
  });
});
