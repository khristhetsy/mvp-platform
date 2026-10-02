import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FounderResults } from "./FounderResults";

const r = { quote: "Q", approvedOn: "2026-10-02" };
describe("FounderResults", () => {
  it("renders nothing with no approved quotes", () => {
    expect(renderToStaticMarkup(createElement(FounderResults))).toBe("");
  });
  it("renders cards, badge and anonymous card once three qualify", () => {
    const html = renderToStaticMarkup(
      createElement(FounderResults, {
        results: [
          { ...r, name: "Ana Diaz", title: "CEO", company: "Acme", crrStart: 52, crrCurrent: 78 },
          { ...r, name: "Bo Li" },
          { ...r, anonymous: true, stage: "Seed", industry: "fintech" },
        ],
      }),
    );
    expect(html).toContain("CRR 52 → 78");
    expect(html).toContain("Score not shared");
    expect(html).toContain("Seed fintech company");
    expect(html).toContain('href="/start"');
  });
});
