/**
 * One email instead of forty.
 */
import { describe, it, expect } from "vitest";
import { digestSubject, introductionDigestHtml } from "@/lib/icfo-events/introduction-emails";

const rows = [
  { name: "Shan Padda", meta: "Harvard MedTech · Seed · HealthTech", pitch: "VR therapy for chronic pain.", respondUrl: "https://icapos.com/e/intro/tok-1" },
  { name: "Michael Doyle", meta: "Doyle Organics", pitch: null, respondUrl: "https://icapos.com/e/intro/tok-2" },
];

const html = introductionDigestHtml({ greeting: "Hi Kenneth,", intro: "Two founders match.", rows });

describe("the digest", () => {
  it("counts the founders in the subject", () => {
    expect(digestSubject(40, "iCFO PE Expo")).toBe("40 founders worth meeting at iCFO PE Expo");
  });

  it("gives every founder their own accept and decline link", () => {
    // Each row keeps its own signed token, so accepting row two lands exactly
    // where row two would have landed on its own.
    expect(html).toContain("https://icapos.com/e/intro/tok-1?a=yes");
    expect(html).toContain("https://icapos.com/e/intro/tok-1?a=no");
    expect(html).toContain("https://icapos.com/e/intro/tok-2?a=yes");
    expect(html).toContain("https://icapos.com/e/intro/tok-2?a=no");
  });

  it("names each founder", () => {
    expect(html).toContain("Shan Padda");
    expect(html).toContain("Michael Doyle");
  });

  it("leaves out a pitch nobody wrote rather than printing an empty line", () => {
    expect(html).toContain("VR therapy for chronic pain.");
    const doyle = html.slice(html.indexOf("Michael Doyle"));
    expect(doyle.slice(0, doyle.indexOf("Accept"))).not.toContain("margin-top:6px");
  });

  it("says declining is silent, once, at the end", () => {
    expect(html.match(/Declining is silent/g)).toHaveLength(1);
  });

  it("carries the compliance footer", () => {
    expect(html).toContain("an offer to sell");
  });

  it("escapes what people typed", () => {
    const nasty = introductionDigestHtml({
      greeting: "Hi,", intro: "x",
      rows: [{ name: "<script>alert(1)</script>", meta: "", pitch: null, respondUrl: "https://x.test/a" }],
    });
    expect(nasty).not.toContain("<script>alert(1)</script>");
    expect(nasty).toContain("&lt;script&gt;");
  });
});
