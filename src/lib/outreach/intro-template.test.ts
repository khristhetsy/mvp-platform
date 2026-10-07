import { describe, expect, it } from "vitest";
import { renderIntroEmail } from "./intro-template";

const base = {
  company: "Northstar Robotics",
  sector: "Robotics",
  stage: "Seed",
  investorFirstName: "Sam",
  unsubscribeUrl: "https://icapos.com/u/abc",
  previewUrl: "https://icapos.com/f/northstar",
  tagline: "Inspection robots for industrial sites",
  raise: "~$2M",
  location: "San Diego",
};

describe("renderIntroEmail (intro_fit_v1)", () => {
  it("keeps the fixed copy word for word", () => {
    const { subject, html, text } = renderIntroEmail(base);
    expect(subject).toBe("Northstar Robotics: a Founder Preview that fits your focus");
    expect(html).toContain("Our fit scoring matched Northstar Robotics to your stated preferences. Here&#39;s their Founder Preview, no obligation.");
    expect(html).toContain("If it&#39;s a fit, simply reply and we&#39;ll make the introduction. If not, no action is needed.");
    expect(html).toContain("Warm regards,<br/>The iCapOS Introductions Team");
    expect(html).toContain("iCapOS is not a broker-dealer or investment adviser. Recipients should conduct their own diligence. iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. This content is for educational purposes only. To stop receiving introductions,");
    expect(html).toContain(">unsubscribe</a>");
    expect(text).toContain("Our fit scoring matched Northstar Robotics to your stated preferences.");
    expect(text).toContain("To stop receiving introductions, unsubscribe: https://icapos.com/u/abc");
  });

  it("adds no headline or eyebrow of its own", () => {
    const { html } = renderIntroEmail(base);
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("text-transform:uppercase;color:#0E7C66;padding:0 0 8px");
  });

  it("shows the one-pager card only when a preview link exists", () => {
    expect(renderIntroEmail(base).html).toContain("View full one-pager");
    expect(renderIntroEmail(base).html).toContain("Robotics");
    expect(renderIntroEmail({ ...base, previewUrl: null }).html).not.toContain("View full one-pager");
  });

  it("escapes merged values", () => {
    const { html } = renderIntroEmail({ ...base, company: "A & B <Co>" });
    expect(html).not.toContain("<Co>");
    expect(html).toContain("A &amp; B &lt;Co&gt;");
  });
});
