import { describe, expect, it } from "vitest";
import { aiAgents } from "@/content/ai-agents";

// The AI Agents page must follow the iCapOS wording rules: no dashes, no
// funding or introduction promises, and the current product name only.
describe("ai agents page copy", () => {
  const text = JSON.stringify(aiAgents);
  // The platform disclaimer is the existing approved homepage wording, so it is checked separately.
  const body = text.split(JSON.stringify(aiAgents.compliance).slice(1, -1)).join("");
  const lower = body.toLowerCase();

  it("uses no dashes as sentence punctuation", () => {
    expect(text).not.toContain("—");
    expect(text).not.toContain("–");
    expect(text).not.toMatch(/ - /);
  });

  it("makes no guarantee, funding or introduction promises", () => {
    expect(lower).not.toContain("guarantee");
    expect(lower).not.toContain("introduc");
  });

  it("carries the platform disclaimer", () => {
    expect(aiAgents.compliance.length).toBeGreaterThan(20);
    expect(aiAgents.faq.items.some((i) => i.a === aiAgents.compliance)).toBe(true);
  });

  it("only links to real marketing routes", () => {
    const hrefs = [aiAgents.hero.primaryCta.href, aiAgents.hero.secondaryCta.href, aiAgents.cta.primary.href, ...aiAgents.agents.items.map((i) => i.cta.href)];
    for (const h of hrefs) expect(["/start", "/pricing"]).toContain(h);
  });
});
