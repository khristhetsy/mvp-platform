import { describe, expect, it } from "vitest";
import { canonicalStages, checkFounder, founderCompanyProfile, isEuCountry } from "./fields";
import { campaignInvestorFromRow, checkBandLabel, networkLabel } from "./investors";
import { investorIdentity, matchFounder, toMasked } from "./matcher";
import { makeFounderToken, verifyFounderToken } from "./token";
import { matchedOn, renderFounderEmail, renderReviewEmail, renderSubject, UNNAMED } from "./email";
import { readMatchConfig } from "./types";
import { buildAdjacency, sectorFit } from "./sector-tier";
import type { FounderFieldsRow } from "./types";

const founder = (over: Partial<FounderFieldsRow> = {}): FounderFieldsRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ada Founder",
  email: "ada@ledgerline.io",
  email_status: "valid",
  suppressed: false,
  company: "Ledgerline",
  country: "United States",
  industries: ["Fintech"],
  funding_stages: ["Seed Round"],
  seeking_amount: [],
  seeking_investor_types: [],
  supabase_profile_id: null,
  pipeline_stage: null,
  founder_type: "lead",
  ...over,
});

const investor = (id: string, industries: string[], stages: string[], extra: Record<string, unknown> = {}) =>
  campaignInvestorFromRow({ id, profile: { industries, fundingStages: stages, investorTypes: ["Venture Capital"], extra }, overrides: null });

describe("data check", () => {
  const opts = { verifiedOnly: true, excludeEu: true, unsubscribed: false };
  it("passes a founder with industry, stage and a verified email", () => {
    expect(checkFounder(founder(), opts)).toBeNull();
  });
  it("excludes missing data before email problems", () => {
    expect(checkFounder(founder({ industries: [], email: null }), opts)).toBe("missing_industry");
    expect(checkFounder(founder({ funding_stages: ["Other"] }), opts)).toBe("missing_stage");
  });
  it("excludes unusable, suppressed, unverified and EU founders", () => {
    expect(checkFounder(founder({ email: "" }), opts)).toBe("no_email");
    expect(checkFounder(founder({ email: "not an email" }), opts)).toBe("invalid_email");
    expect(checkFounder(founder({ email_status: "invalid" }), opts)).toBe("invalid_email");
    expect(checkFounder(founder(), { ...opts, unsubscribed: true })).toBe("suppressed");
    expect(checkFounder(founder({ email_status: "unverified" }), opts)).toBe("email_unverified");
    expect(checkFounder(founder({ email_status: "unverified" }), { ...opts, verifiedOnly: false })).toBeNull();
    expect(checkFounder(founder({ country: "France" }), opts)).toBe("eu_excluded");
    expect(checkFounder(founder({ country: "France" }), { ...opts, excludeEu: false })).toBeNull();
  });
  it("holds back low-confidence industry and guessed stage unless included", () => {
    expect(checkFounder(founder({ industry_source: "inferred:low" }), opts)).toBe("unconfirmed_data");
    expect(checkFounder(founder({ stage_source: "guess:default" }), opts)).toBe("unconfirmed_data");
    expect(checkFounder(founder({ industry_source: "keyword:low" }), opts)).toBe("unconfirmed_data");
    expect(checkFounder(founder({ industry_source: "inferred:high", stage_source: "crm:extra" }), opts)).toBeNull();
    expect(checkFounder(founder({ stage_source: "guess:default" }), { ...opts, includeInferred: true })).toBeNull();
  });
  it("knows EU and GDPR-equivalent countries", () => {
    expect(isEuCountry("Germany")).toBe(true);
    expect(isEuCountry("United Kingdom")).toBe(true);
    expect(isEuCountry("United States")).toBe(false);
    expect(isEuCountry(null)).toBe(false);
  });
});

describe("stages", () => {
  it("keeps only the funding stage vocabulary, canonical and deduped", () => {
    expect(canonicalStages(["Seed Round", "seed", "Series A", "Other", "Acquired", "Pre-Seed"])).toEqual(["Seed Round", "Series A", "Pre-Seed"]);
  });
});

describe("matching", () => {
  const company = founderCompanyProfile(founder());
  it("matches only investors aligned on both industry and stage", () => {
    const pool = [
      investor("a", ["Fintech"], ["Seed Round", "Series A"]),
      investor("b", ["Fintech"], ["Series B"]), // stage miss
      investor("c", ["Healthcare"], ["Seed Round"]), // industry miss
      investor("d", [], ["Seed Round"]), // no sectors
    ];
    const m = matchFounder(company, pool);
    expect(m.map((x) => x.investor_contact_id)).toEqual(["a"]);
    expect(m[0].match_score).toBeGreaterThan(0);
    expect(m[0].match_score).toBeLessThanOrEqual(100);
  });
  it("drops investors below the campaign's minimum match score", () => {
    const f = founderCompanyProfile(founder({ seeking_amount: ["$500k - $1m"] }));
    const pool = [
      investor("fit", ["Fintech"], ["Seed Round"], { "Investor investment size?": ["$500k - $1m"] }),
      investor("far", ["Fintech"], ["Seed Round"], { "Investor investment size?": ["$10m - $50m"] }),
    ];
    const all = matchFounder(f, pool);
    const scores = all.map((m) => m.match_score);
    const floor = Math.max(...scores);
    expect(scores.some((s) => s < floor)).toBe(true);
    expect(matchFounder(f, pool, undefined, floor).map((m) => m.investor_contact_id)).toEqual(["fit"]);
  });
  it("does not let Pre-Seed match Seed Round by substring", () => {
    const m = matchFounder(founderCompanyProfile(founder({ funding_stages: ["Pre-Seed"] })), [investor("a", ["Fintech"], ["Seed Round"])]);
    expect(m).toHaveLength(0);
  });
  it("ranks a better check size fit higher", () => {
    const f = founderCompanyProfile(founder({ seeking_amount: ["$500k - $1m"] }));
    const m = matchFounder(f, [
      investor("far", ["Fintech"], ["Seed Round"], { "Investor investment size?": ["$10m - $50m"] }),
      investor("fit", ["Fintech"], ["Seed Round"], { "Investor investment size?": ["$500k - $1m"] }),
    ]);
    expect(m[0].investor_contact_id).toBe("fit");
  });
  it("never carries investor identity in the masked fields", () => {
    const [m] = matchFounder(company, [investor("a", ["Fintech"], ["Seed Round"])]);
    expect(Object.keys(m).sort()).toEqual(["check_band", "investor_contact_id", "investor_type", "match_score", "matched_sectors", "reasons", "sector_tier", "sectors", "stages"]);
  });
});

describe("token", () => {
  it("round-trips and rejects tampering", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const t = makeFounderToken(id);
    expect(verifyFounderToken(t)).toBe(id);
    expect(verifyFounderToken(t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBeNull();
    const other = makeFounderToken("33333333-3333-4333-8333-333333333333");
    expect(verifyFounderToken(`${t.split(".")[0]}.${other.split(".")[1]}`)).toBeNull();
    expect(verifyFounderToken("garbage")).toBeNull();
    expect(verifyFounderToken(null)).toBeNull();
  });
});

describe("email", () => {
  const html = renderFounderEmail({
    company: "Ledgerline",
    industry: "Fintech",
    stages: ["Seed Round"],
    matchCount: 24,
    top: [
      { investor_name: "Michael Karas", investor_firm: "Karas Partners", investor_type: "VC", sectors: ["Fintech"], stages: ["Seed Round", "Series A"], check_band: null, match_score: 92 },
      { investor_name: "Kae Huynh", investor_firm: null, investor_type: "Family office", sectors: ["Fintech", "SaaS"], stages: ["Seed Round"], check_band: null, match_score: 88 },
      { investor_type: "Angel", sectors: ["Fintech"], stages: ["Pre-Seed"], check_band: null, match_score: 81 },
    ],
    networkLabel: "7,000+",
    basicPrice: "$49/mo",
    links: { matches: "https://icapos.com/matches/t", call: "https://icapos.com/mc/t?a=call", plan: "https://icapos.com/mc/t?a=intro", privacy: "https://icapos.com/privacy" },
    postalAddress: "iCFO Capital Global, Inc., La Jolla, CA",
  });
  it("has the note, top 3 with names, see-all link and both buttons", () => {
    expect(html).toContain("7,000+ investors");
    expect(html).toContain("24 investors</strong> fit your industry and stage");
    expect(html).toContain("Michael Karas");
    expect(html).toContain("· Karas Partners");
    expect(html).toContain("Kae Huynh");
    expect(html).toContain(`>${UNNAMED}<`);
    expect(html).toContain("Contact details and Request introduction unlock with a plan.");
    expect(html).not.toContain("Investor names and Request introduction");
    expect(html).toContain("92% match");
    expect(html).toContain("21 more matches");
    expect(html).toContain("See all 24 matches");
    expect(html).toContain("Schedule a call with us");
    expect(html).toContain("Choose a plan to unlock");
    expect(html).toContain("Plans from $49/mo");
  });
  it("says match, never interested", () => {
    expect(html.toLowerCase()).not.toContain("interested");
  });
  it("fills the subject", () => {
    expect(renderSubject("{match_count} investors in our network match {company}", { matchCount: 24, company: "Ledgerline" })).toBe("24 investors in our network match Ledgerline");
  });
});

describe("helpers", () => {
  it("formats network and check bands", () => {
    expect(networkLabel(7245)).toBe("7,000+");
    expect(networkLabel(812)).toBe("812");
    expect(checkBandLabel(250_000, 1_000_000)).toBe("$250K to $1M");
    expect(checkBandLabel(null, null)).toBeNull();
  });
  it("reads config with safe defaults", () => {
    const c = readMatchConfig({ daily_cap: -3, dry_run: false });
    expect(c.daily_cap).toBe(150);
    expect(c.dry_run).toBe(false);
    expect(c.verified_only).toBe(true);
    expect(c.preview_count).toBe(3);
    expect(c.min_score).toBe(70);
    expect(readMatchConfig({ min_score: 140 }).min_score).toBe(100);
  });
});

describe("investor identity shown to founders", () => {
  it("shows the firm only when it differs from the name", () => {
    expect(investorIdentity("Michael Karas", "Karas Partners")).toEqual({ investor_name: "Michael Karas", investor_firm: "Karas Partners" });
    expect(investorIdentity("Kae Huynh", "Kae Huynh")).toEqual({ investor_name: "Kae Huynh", investor_firm: null });
    expect(investorIdentity("Kae Huynh", " kae huynh ")).toEqual({ investor_name: "Kae Huynh", investor_firm: null });
    expect(investorIdentity("Alan Fisher", null)).toEqual({ investor_name: "Alan Fisher", investor_firm: null });
  });
  it("falls back to the firm when there is no name", () => {
    expect(investorIdentity(null, "Harbor Seed")).toEqual({ investor_name: "Harbor Seed", investor_firm: null });
    expect(investorIdentity("  ", null)).toEqual({ investor_name: null, investor_firm: null });
  });
  it("the snapshot keeps name and firm and never carries contact ids or reasons", () => {
    const snap = toMasked({ investor_contact_id: "c1", reasons: ["x"], investor_name: "Ben Paulo", investor_firm: null, investor_type: "Angel", sectors: ["A", "B", "C", "D", "E"], stages: ["Seed Round"], check_band: null, match_score: 70 } as Parameters<typeof toMasked>[0]);
    expect(snap).toEqual({ investor_name: "Ben Paulo", investor_firm: null, investor_type: "Angel", sectors: ["A", "B", "C", "D"], stages: ["Seed Round"], check_band: null, match_score: 70 });
  });
});

describe("sector tier", () => {
  const biotech = ["Biotechnology/Life Science"];
  const adj = buildAdjacency([
    { industry: "Biotechnology/Life Science", adjacent_industry: "Healthcare" },
    { industry: "Biotechnology/Life Science", adjacent_industry: "Medical Devices" },
    { industry: "Biotechnology/Life Science", adjacent_industry: "Digital Health" },
  ]);
  it("never matches Technology to Biotechnology by substring", () => {
    expect(sectorFit(biotech, ["Software", "Technology/Web"], adj)).toBeNull();
    expect(sectorFit(biotech, ["Software", "Technology/Web"])).toBeNull();
  });
  it("finds exact, adjacent and generalist fits with the sectors that matched", () => {
    expect(sectorFit(biotech, ["Biotechnology/Life Science", "Healthcare"], adj)).toEqual({ tier: "exact", matched: ["Biotechnology/Life Science"] });
    expect(sectorFit(biotech, ["Cleantech", "Consumer Products", "Healthcare", "Software"], adj)).toEqual({ tier: "adjacent", matched: ["Healthcare"] });
    expect(sectorFit(biotech, ["Agnostic"], adj)?.tier).toBe("generalist");
    const broad = ["Agriculture", "Apparel", "Biotechnology/Life Science", "Blockchain", "Business Service", "Cleantech", "Construction", "Energy", "Entertainment", "Financial Services", "SaaS"];
    expect(sectorFit(biotech, broad, adj)).toEqual({ tier: "generalist", matched: ["Biotechnology/Life Science"] });
    expect(sectorFit(biotech, broad.filter((x) => !x.startsWith("Bio")).concat("Telecom"), adj)).toBeNull();
  });
  it("uses the adjacency table when an industry has rows, synonym families otherwise", () => {
    expect(sectorFit(biotech, ["Pharma"], adj)).toBeNull();
    expect(sectorFit(biotech, ["Pharma"])).toEqual({ tier: "adjacent", matched: ["Pharma"] });
  });
  it("ranks exact before adjacent before generalist, then by score", () => {
    const f = founderCompanyProfile(founder({ industries: biotech, funding_stages: ["Pre-Seed"] }));
    const pool = [
      investor("adj", ["Healthcare", "Medical Devices"], ["Pre-Seed"]),
      investor("gen", ["Agnostic"], ["Pre-Seed"]),
      investor("soft", ["Software", "Technology/Web"], ["Pre-Seed"]),
      investor("exact", ["Biotechnology/Life Science", "Healthcare"], ["Pre-Seed"]),
    ];
    const m = matchFounder(f, pool, undefined, 0, { founderIndustries: biotech, adjacency: adj });
    expect(m.map((x) => x.investor_contact_id)).toEqual(["exact", "adj", "gen"]);
    expect(m[0].reasons).toContain("Sector alignment: Biotechnology/Life Science");
  });
});

describe("review flow", () => {
  it("keeps live campaigns on the plan layout and starts new ones on review", () => {
    expect(readMatchConfig({}).flow).toBe("plan");
    expect(readMatchConfig({ flow: "review" }).flow).toBe("review");
    expect(readMatchConfig({ flow: "review" }).visible_count).toBe(3);
    expect(readMatchConfig({ visible_count: 2 }).visible_count).toBe(2);
  });

  const html = renderReviewEmail({
    company: "NanoRetinal",
    industry: "Biotechnology/Life Science",
    stages: ["Pre-Seed"],
    matchCount: 5,
    visibleCount: 3,
    top: [
      { investor_name: "Ben Paulo", investor_firm: null, investor_type: "Angel", sectors: ["Biotechnology/Life Science", "Healthcare"], matched_sectors: ["Biotechnology/Life Science"], stages: ["Seed Round", "Pre-Seed"], check_band: null, match_score: 70 },
      { investor_name: "Kae Huynh", investor_firm: "Huynh Capital", investor_type: "Angel", sectors: ["Cleantech", "Healthcare"], matched_sectors: ["Healthcare"], stages: ["Pre-Seed"], check_band: null, match_score: 80 },
      { investor_name: null, investor_type: "Angel", sectors: ["Medical Devices"], stages: ["Pre-Seed"], check_band: null, match_score: 72 },
    ],
    networkLabel: "7,000+",
    basicPrice: "$49/mo",
    links: { matches: "https://icapos.com/matches/t", call: "https://icapos.com/mc/t?a=call", plan: "https://icapos.com/mc/t?a=intro", privacy: "https://icapos.com/privacy", profile: (n) => `https://icapos.com/matches/t/i/${n}` },
    postalAddress: "iCFO Capital Global, Inc., La Jolla, CA",
  });
  it("shows what each investor matched on, links profiles, and never a match %", () => {
    expect(html).toContain("Matched on: Pre-seed, Biotechnology/Life Science");
    expect(html).toContain("Matched on: Pre-seed, Healthcare");
    expect(html).toContain("https://icapos.com/matches/t/i/2");
    expect(html).not.toContain("% match");
    expect(html).not.toContain("Cleantech");
  });
  it("has one booking button, the plan as secondary, the locked count and a complete footer", () => {
    expect(html).toContain("Pick a time for your match review");
    expect(html).toContain("Choose a plan to unlock");
    expect(html).toContain("2 more matches and contact details open with a plan.");
    expect(html).toContain("See all 5 matches");
    expect(html).toContain("You're receiving this because NanoRetinal is listed in Biotechnology/Life Science at Pre-seed");
    expect(html).not.toContain("Schedule a call with us");
    expect(html.toLowerCase()).not.toContain("interested");
  });
  it("matchedOn prefers the founder's stage and the matched sectors", () => {
    expect(matchedOn({ investor_type: null, sectors: ["Software", "Healthcare"], matched_sectors: ["Healthcare"], stages: ["Seed Round", "Pre-Seed"], check_band: null, match_score: 0 }, ["Pre-Seed"])).toBe("Pre-seed, Healthcare");
  });
});
