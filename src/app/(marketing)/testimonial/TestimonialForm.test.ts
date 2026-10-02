import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestimonialForm } from "./TestimonialForm";

describe("TestimonialForm", () => {
  it("renders the greeting, score badge and consent box", () => {
    const html = renderToStaticMarkup(createElement(TestimonialForm, { token: "t.x", firstName: "Alan", companyName: "Brainiest AI", crr: { start: 28, current: 76 }, alreadyApproved: false }));
    expect(html).toContain("Thanks, Alan");
    expect(html).toContain("CRR 28 → 76 · Brainiest AI");
    expect(html).toContain("Show my CRR score change");
    expect(html).toContain("I agree iCapOS may publish");
  });
  it("hides the score option when there is no CRR rise", () => {
    const html = renderToStaticMarkup(createElement(TestimonialForm, { token: "t.x", firstName: "Sam", companyName: null, crr: null, alreadyApproved: false }));
    expect(html).not.toContain("Show my CRR score change");
  });
});
