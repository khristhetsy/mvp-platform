/**
 * One email instead of forty.
 */
import { describe, it, expect } from "vitest";
import { digestSubject, introductionDigestHtml, purposeBlock } from "@/lib/icfo-events/introduction-emails";

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

describe("a test send", () => {
  const test = introductionDigestHtml({
    greeting: "Hi Kenneth,", intro: "Two founders match.", rows, test: true,
  });

  it("says so at the top", () => {
    expect(test).toContain("Test send. The buttons below do nothing");
  });

  it("does not say so on a real one", () => {
    expect(html).not.toContain("Test send.");
  });
});

describe("the purpose block itself", () => {
  it("escapes an event title somebody typed", () => {
    const out = purposeBlock({ eventTitle: "<script>x</script>", when: null });
    expect(out).not.toContain("<script>x</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("the networking purpose line", () => {
  const withPurpose = introductionDigestHtml({
    greeting: "Hi Kenneth,", intro: "Two founders match.", rows,
    purpose: { eventTitle: "iCFO PE Expo — Las Vegas", when: "Tue 22 Sep 2026" },
  });

  it("names the event and the date, once", () => {
    expect(withPurpose).toContain("for networking at the upcoming iCFO Capital event");
    expect(withPurpose).toContain("iCFO PE Expo — Las Vegas, Tue 22 Sep 2026");
    expect(withPurpose.match(/upcoming iCFO Capital event/g)).toHaveLength(1);
  });

  it("drops the date rather than printing an empty comma", () => {
    const noDate = introductionDigestHtml({
      greeting: "Hi,", intro: "x", rows,
      purpose: { eventTitle: "iCFO PE Expo", when: null },
    });
    expect(noDate).toContain("event — iCFO PE Expo.");
  });

  it("says nothing when the event is unknown", () => {
    expect(html).not.toContain("upcoming iCFO Capital event");
  });

  it("does not claim anything about who registered", () => {
    expect(withPurpose).not.toContain("registered to attend");
  });
});
