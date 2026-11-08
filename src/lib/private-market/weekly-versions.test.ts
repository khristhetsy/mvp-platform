import { describe, expect, it } from "vitest";
import { defaultConfig, renderWeeklyEmail, versionAudience, VERSIONS, SECTION_OPTIONS, type EmailLinks } from "./weekly-email";
import { hasIntroActivity, type DigestMarket, type DigestViewer } from "./weekly-digest";

const links: EmailLinks = { appUrl: "https://icapos.com", logoUrl: "https://icapos.com/email-logo.png", unsubscribeUrl: "https://icapos.com/unsubscribe?token=t", preferencesUrl: "https://icapos.com/preferences" };
const market: DigestMarket = {
  range: "30 Oct to 6 Nov 2026", asOfLabel: "6 Nov 2026", avgCrr: 58,
  tiles: [], gainers: [], sectors: [], approvedTotal: 33, newlyApproved: { count: 2, scored: 1 }, moves: [],
  newCompanies: [
    { symbol: "ACME", name: "Acme Inc.", sector: "Fintech", crr: 72, rank: 12, of: 22, sectorAvg: 61.4 },
    { symbol: "BETA", name: "Beta LLC", sector: null, crr: null, rank: null, of: 22, sectorAvg: null },
  ],
  monthly: {
    range: "9 Oct to 8 Nov 2026",
    approved: { total: 33, added: 6, addedBefore: 4 },
    avgCrr: { now: 58, before: 56.6 },
    scored: { now: 22, before: 19 },
    intros: { now: 21, before: 16 },
    gainers: [{ symbol: "ACME", crr: 72, change: 9, pct: 14.3 }],
  },
};
const withIntros: DigestViewer = { kind: "investor", matches: [], hasProfile: true, intros: { requested: 3, facilitated: 2, declined: 0, reviewing: 1, latest: [{ symbol: "ACME", status: "facilitated" }, { symbol: "BETA", status: "requested" }] } };
const idle: DigestViewer = { kind: "investor", matches: [], hasProfile: true, intros: { requested: 0, facilitated: 0, declined: 0, reviewing: 2, latest: [] } };

describe("versions", () => {
  it("has five versions and every one has default sections", () => {
    expect(VERSIONS).toHaveLength(5);
    for (const v of VERSIONS) expect(SECTION_OPTIONS[v].length).toBeGreaterThan(0);
  });
  it("sends the three new emails to investors", () => {
    expect(versionAudience("founder")).toBe("founder");
    for (const v of ["investor", "listed", "intros", "monthly"] as const) expect(versionAudience(v)).toBe("investor");
  });
});

describe("new company listed", () => {
  const out = renderWeeklyEmail({ config: defaultConfig("listed"), market, viewer: { kind: "investor", matches: [], hasProfile: true }, links });
  it("shows each new company with real figures", () => {
    expect(out.html).toContain("New on the Private Market");
    expect(out.html).toContain("ACME");
    expect(out.html).toContain("Acme Inc.");
    expect(out.html).toContain("72");
    expect(out.html).toContain("12th of 22");
    expect(out.html).toContain("61.4");
    expect(out.html).toContain("Not rated yet");
    expect(out.subject).toBe("New on the Private Market: 2 approved this week");
  });
  it("leaves the weekly sections out", () => {
    expect(out.html).not.toContain("THE MARKET THIS WEEK");
    expect(out.html).not.toContain("YOUR TOP MATCHES");
  });
  it("says so when no company was approved", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("listed"), market: { ...market, newCompanies: [] }, viewer: { kind: "investor", matches: [], hasProfile: true }, links });
    expect(r.html).toContain("No company was approved");
  });
});

describe("introduction update", () => {
  it("shows the investor's own counts and latest requests", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("intros"), market, viewer: withIntros, links });
    expect(r.html).toContain("Your introductions");
    expect(r.html).toContain("Requested this week");
    expect(r.html).toContain("Facilitated");
    expect(r.html).toContain("Under review now");
    expect(r.html).toContain("https://icapos.com/investor/opportunities");
  });
  it("detects activity", () => {
    expect(hasIntroActivity(withIntros.kind === "investor" ? withIntros.intros : undefined)).toBe(true);
    expect(hasIntroActivity(idle.kind === "investor" ? idle.intros : undefined)).toBe(false);
    expect(hasIntroActivity(undefined)).toBe(false);
  });
  it("never invents counts for an investor with no activity", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("intros"), market, viewer: idle, links });
    expect(r.html).toContain("No introduction activity this week");
    expect(r.html).not.toContain("Requested this week");
  });
});

describe("monthly recap", () => {
  const out = renderWeeklyEmail({ config: defaultConfig("monthly"), market, viewer: { kind: "investor", matches: [], hasProfile: true }, links });
  it("shows the month against the month before", () => {
    expect(out.html).toContain("The month on the Private Market");
    expect(out.html).toContain("9 Oct to 8 Nov 2026");
    expect(out.html).toContain("Introductions requested");
    expect(out.html).toContain("+5");
    expect(out.html).toContain("58.0");
    expect(out.html).toContain("30 days to 6 Nov 2026");
  });
  it("lists the gainers of the month", () => {
    expect(out.html).toContain("TOP GAINERS OF THE MONTH");
    expect(out.html).toContain("ACME");
  });
  it("does not claim figures when the monthly data is missing", () => {
    const r = renderWeeklyEmail({ config: defaultConfig("monthly"), market: { ...market, monthly: undefined }, viewer: { kind: "investor", matches: [], hasProfile: true }, links });
    expect(r.html).toContain("could not be read");
  });
  it("uses no dashes as punctuation in the copy", () => {
    expect(out.text).not.toMatch(/ [—–] /);
  });
});
