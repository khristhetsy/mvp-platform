import { describe, expect, it } from "vitest";
import { defaultConfig, fillMerge, renderWeeklyEmail, testSubject, type EmailLinks } from "./weekly-email";
import type { DigestMarket, DigestViewer } from "./weekly-digest";

const links: EmailLinks = { appUrl: "https://icapos.com", logoUrl: "https://icapos.com/email-logo.png", unsubscribeUrl: "https://icapos.com/unsubscribe?token=t", preferencesUrl: "https://icapos.com/preferences" };
const market: DigestMarket = {
  range: "30 Oct to 6 Nov 2026", asOfLabel: "6 Nov 2026", avgCrr: 58,
  tiles: [{ label: "AVG CRR", value: "58.0", change: 7, delta: "▲ +7.00 · +13.7%" }, { label: "FOUNDERS SCORED", value: "22", change: 3, delta: "▲ +3 · +15.8%" }],
  gainers: [{ symbol: "OPHTHA", crr: 90, change: 89, pct: 8900 }],
  sectors: [{ sector: "AI / ML", avg: 96.5, scored: 2 }],
  approvedTotal: 33, newlyApproved: { count: 10, scored: 2 }, moves: [{ symbol: "OPHTHA", from: 3, to: 90 }],
};
const scored: DigestViewer = { kind: "founder", rating: { score: 84, band: "strong", weekChange: 0, weekAgo: 84, firstScore: 25, firstAt: "2026-09-18", sinceFirst: 59, rank: 9, of: 22 } };

describe("merge fields", () => {
  it("fills rating, band and approved", () => {
    expect(fillMerge("Your rating is {rating} ({band}). Week", { rating: 84, band: "Strong", approved: 10 })).toBe("Your rating is 84 (Strong). Week");
    expect(fillMerge("{approved} companies approved", { rating: null, band: null, approved: 10 })).toBe("10 companies approved");
  });
  it("never leaves an empty rating in the subject", () => {
    expect(fillMerge("Your rating is {rating} ({band}). The Private Market this week", { rating: null, band: null, approved: 0 })).toBe("Get your rating. The Private Market this week");
  });
  it("prefixes test subjects once", () => {
    expect(testSubject("Hello")).toBe("[TEST] Hello");
    expect(testSubject("[TEST] Hello")).toBe("[TEST] Hello");
  });
});

describe("founder email", () => {
  const out = renderWeeklyEmail({ config: defaultConfig("founder"), market, viewer: scored, links });
  it("shows the founder's own rating, rank and the market", () => {
    expect(out.subject).toBe("Your rating is 84 (Strong). The Private Market this week");
    expect(out.html).toContain(">84<");
    expect(out.html).toContain("9th of 22");
    expect(out.html).toContain("+59 since your first reading");
    expect(out.html).toContain("OPHTHA");
    expect(out.html).toContain("AI / ML");
    expect(out.html).toContain("Unsubscribe");
    expect(out.html).toContain("iCFO Capital Global, Inc., La Jolla, CA");
    expect(out.html).not.toContain("not investment advice");
  });
  it("asks an unscored founder to start the assessment", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("founder"), market, viewer: { kind: "founder", rating: null }, links });
    expect(r.html).toContain("Start your readiness assessment");
    expect(r.subject.startsWith("Get your rating.")).toBe(true);
  });
  it("gives a list contact the market sections only", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("founder"), market, viewer: { kind: "founder", marketOnly: true }, links });
    expect(r.html).not.toContain("YOUR RATING");
    expect(r.html).toContain("THE MARKET THIS WEEK");
    expect(r.html).toContain("You receive this because you are on an iCapOS mailing list.");
  });
  it("honours turned off sections, the note and the button text", () => {
    const cfg = { ...defaultConfig("founder"), note: "A note <b>x</b>", buttonText: "Go", sections: { rating: true, market: false, gainers: false, sectors: false } };
    const r = renderWeeklyEmail({ config: cfg, market, viewer: scored, links });
    expect(r.html).not.toContain("THE MARKET THIS WEEK");
    expect(r.html).not.toContain("TOP GAINERS");
    expect(r.html).toContain("A note &lt;b&gt;x&lt;/b&gt;");
    expect(r.html).toContain(">Go<");
  });
  it("explains who is listed above the rankings, and can be turned off", () => {
    const on = renderWeeklyEmail({ config: defaultConfig("founder"), market, viewer: scored, links });
    expect(on.html).toContain("WHO IS LISTED");
    expect(on.html).toContain("Finish your readiness assessment to be listed.");
    expect(on.html.indexOf("WHO IS LISTED")).toBeLessThan(on.html.indexOf("TOP GAINERS"));
    expect(on.html).toContain("Only companies with a qualifying CRR are ranked.");
    const cfg = { ...defaultConfig("founder"), sections: { ...defaultConfig("founder").sections, listedNote: false } };
    const off = renderWeeklyEmail({ config: cfg, market, viewer: scored, links });
    expect(off.html).not.toContain("WHO IS LISTED");
    expect(off.html).not.toContain("qualifying CRR");
  });
  it("marks a test send", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("founder"), market, viewer: scored, links, test: true });
    expect(r.subject.startsWith("[TEST] ")).toBe(true);
    expect(r.html).toContain("TEST SEND");
  });
});

describe("email header", () => {
  const banner = "https://example.com/banner.jpg";
  it("keeps the logo and title block by default", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("founder"), market, viewer: scored, links });
    expect(r.html).toContain("email-logo.png");
    expect(r.html).toContain("THE PRIVATE MARKET · WEEKLY");
  });
  it("shows the banner with a title strip in place of the logo and title block", () => {
    const cfg = { ...defaultConfig("founder"), headerMode: "banner" as const, bannerUrl: banner };
    const r = renderWeeklyEmail({ config: cfg, market, viewer: scored, links });
    expect(r.html).toContain(`src="${banner}"`);
    expect(r.html).not.toContain("email-logo.png");
    expect(r.html).not.toContain("THE PRIVATE MARKET · WEEKLY");
    expect(r.html).toContain("Your rating this week");
    expect(r.html).toContain("30 Oct to 6 Nov 2026");
  });
  it("can drop the strip, and falls back to the logo when no banner is set", () => {
    const noStrip = renderWeeklyEmail({ config: { ...defaultConfig("investor"), headerMode: "banner", bannerUrl: banner, bannerStrip: false }, market, viewer: { kind: "investor", marketOnly: true }, links });
    expect(noStrip.html).not.toContain("What moved this week");
    const missing = renderWeeklyEmail({ config: { ...defaultConfig("founder"), headerMode: "banner", bannerUrl: null }, market, viewer: scored, links });
    expect(missing.html).toContain("email-logo.png");
  });
});

describe("investor email", () => {
  const viewer: DigestViewer = { kind: "investor", hasProfile: true, matches: [{ symbol: "NAI", name: "NAI Technology", match: 88, crr: 84, sector: "AI" }] };
  const out = renderWeeklyEmail({ config: defaultConfig("investor"), market, viewer, links });
  it("shows matches, newly approved, rating moves and the disclaimer", () => {
    expect(out.subject).toBe("10 companies approved this week. Your top matches inside");
    expect(out.html).toContain("YOUR TOP MATCHES");
    expect(out.html).toContain("88%");
    expect(out.html).toContain("NEWLY APPROVED");
    expect(out.html).toContain("RATING MOVES");
    expect(out.html).toContain("not investment advice");
  });
  it("uses the investor wording for who is listed", () => {
    expect(out.html).toContain("ranked or matched in this email");
  });
  it("asks an investor without a profile to complete it", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("investor"), market, viewer: { kind: "investor", matches: [], hasProfile: false }, links });
    expect(r.html).toContain("Complete your investor profile");
  });
});

describe("sign off under the note", () => {
  const cfg = { ...defaultConfig("founder"), note: "New this week: the board lists every sector." };
  it("prints Written by NAME under the note when set", () => {
    const out = renderWeeklyEmail({ config: { ...cfg, signOff: "iCFO Capital" }, market, viewer: scored, links });
    expect(out.html).toContain("Written by iCFO Capital");
    expect(out.text).toContain("Written by iCFO Capital");
  });
  it("prints nothing when off, or when there is no note", () => {
    expect(renderWeeklyEmail({ config: cfg, market, viewer: scored, links }).html).not.toContain("Written by");
    expect(renderWeeklyEmail({ config: { ...defaultConfig("founder"), signOff: "iCFO Capital" }, market, viewer: scored, links }).html).not.toContain("Written by");
  });
  it("escapes the name", () => {
    expect(renderWeeklyEmail({ config: { ...cfg, signOff: "A <b>Co</b>" }, market, viewer: scored, links }).html).toContain("Written by A &lt;b&gt;Co&lt;/b&gt;");
  });
});
