import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUDIENCE_COLOR, fromFor, renderEmail, safeUrl, type EmailSpec } from "./layout";

const base: EmailSpec = {
  audience: "admin",
  subject: "10 founders need attention: KoreInside awaits your approval",
  preheader: "9 idle, longest is Nostro at 54 days.",
  context: "Team digest · Sun 27 Sep",
  eyebrow: "Daily founder digest",
  headline: "10 founders need attention today",
  intro: "One is waiting on your stage approval.",
  blocks: [
    { type: "stats", items: [{ value: "1", label: "awaiting approval" }, { value: "9", label: "idle founders" }] },
    { type: "rows", title: "Idle, longest first", items: [{ title: "Nostro", subtitle: "Marketing", right: "54d", url: "/admin/journey", bar: 100 }] },
  ],
  primary: { label: "Open the journey board", url: "https://icapos.com/admin/journey" },
  footer: { reason: "Internal. Sent daily to admin and analyst roles.", preferencesUrl: "/admin/settings", preferencesLabel: "Digest settings" },
};

describe("renderEmail", () => {
  it("returns the subject unchanged", () => {
    expect(renderEmail(base).subject).toBe(base.subject);
  });

  it("puts the preheader first and hidden", () => {
    const { html } = renderEmail(base);
    const pre = html.indexOf("9 idle, longest is Nostro");
    expect(pre).toBeGreaterThan(-1);
    expect(pre).toBeLessThan(html.indexOf("10 founders need attention today"));
    expect(html).toContain("display:none");
  });

  it("uses the audience color for the rule", () => {
    expect(renderEmail(base).html).toContain(`height:3px;background:${AUDIENCE_COLOR.admin}`);
    expect(renderEmail({ ...base, audience: "investor" }).html).toContain(`height:3px;background:${AUDIENCE_COLOR.investor}`);
  });

  it("escapes every value", () => {
    const { html } = renderEmail({
      ...base,
      headline: `<script>alert(1)</script>`,
      blocks: [{ type: "rows", items: [{ title: `COGNITIVE SCIENCE & SOLUTIONS <b>INC</b>` }] }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("COGNITIVE SCIENCE &amp; SOLUTIONS &lt;b&gt;INC&lt;/b&gt;");
  });

  it("drops unsafe link schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("https://icapos.com/x?a=1&b=2")).toBe("https://icapos.com/x?a=1&amp;b=2");
    expect(safeUrl("/admin/journey")).toMatch(/^https?:\/\/.+\/admin\/journey$/);
  });

  it("builds plain text from the same input, with absolute links", () => {
    const { text } = renderEmail(base);
    expect(text).toContain("10 founders need attention today");
    expect(text).toContain("- Nostro (Marketing): 54d");
    expect(text).toMatch(/Open the journey board: https:\/\/icapos\.com\/admin\/journey/);
    expect(text).toMatch(/Digest settings: https?:\/\/.+\/admin\/settings/);
    expect(text).toContain("iCFO Capital Global, Inc.");
    expect(text).not.toContain("<");
  });

  it("always has the footer reason and legal line", () => {
    const { html } = renderEmail({ ...base, blocks: [], primary: null, footer: { reason: "Why you got this.", lines: ["Line two."] } });
    expect(html).toContain("Why you got this.");
    expect(html).toContain("Line two.");
    expect(html).toContain("iCFO Capital Global, Inc.");
  });

  it("renders every block type without throwing", () => {
    const { html, text } = renderEmail({
      ...base,
      audience: "founder",
      blocks: [
        { type: "paragraph", text: "Hi Maya," },
        { type: "facts", rows: [{ label: "Stage", value: "Preparation" }] },
        { type: "checklist", title: "Still needed", items: [{ label: "Cap table", done: false }, { label: "Pitch deck", done: true, note: "deck.pdf" }] },
        { type: "progress", label: "Data room", value: "55%", percent: 55 },
        { type: "journey", step: 2 },
        { type: "note", text: "Heads up", tone: "warning" },
        { type: "quote", label: "Sam Park", meta: "10:14", text: "Send the deck?" },
        { type: "action", title: "KoreInside", subtitle: "Preparation", button: { label: "Review", url: "/admin/journey" } },
        { type: "card", name: "Northstar Robotics", tagline: "Inspection robots", meta: [{ label: "Stage", value: "Seed" }] },
      ],
    });
    expect(html).toContain("Match");
    expect(text).toContain("[ ] Cap table");
    expect(text).toContain("[x] Pitch deck (deck.pdf)");
    expect(text).toContain("step 3 of 4 (Match)");
  });
});

describe("fromFor", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ["EMAIL_FROM", "TRANSACTIONAL_EMAIL_FROM"]) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  it("gives each audience its sender name on the verified address", () => {
    expect(fromFor("admin")).toBe("iCapOS Ops <no-reply@icapos.com>");
    expect(fromFor("founder")).toBe("iCapOS <no-reply@icapos.com>");
    expect(fromFor("investor")).toBe("iCFO Capital Global <no-reply@icapos.com>");
  });

  it("lets a caller name the sender", () => {
    expect(fromFor("investor", "iCFO Venture Group")).toBe("iCFO Venture Group <no-reply@icapos.com>");
    expect(fromFor("founder", "  ")).toBe("iCapOS <no-reply@icapos.com>");
  });
});
